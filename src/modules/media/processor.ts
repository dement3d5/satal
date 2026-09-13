import {randomUUID} from 'node:crypto';

import {and, asc, eq, inArray, isNull, lte, or, sql} from 'drizzle-orm';
import sharp from 'sharp';

import type {DatabaseClient} from '@/server/db/client';
import {mediaAsset, mediaVariant} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {getMediaStorage, type MediaProcessingStorage} from './storage';

const MAX_IMAGE_DIMENSION = 12_000;
const MAX_INPUT_PIXELS = 40_000_000;
export const MEDIA_PROCESSING_LEASE_MS = 10 * 60_000;
export const MEDIA_RETRY_MAX_DELAY_MS = 60 * 60_000;
export const MEDIA_QUARANTINE_CLEANUP_GRACE_MS = 60 * 60_000;
export const MEDIA_BACKLOG_SLA_MS = 15 * 60_000;

const variants = [
  {kind: 'thumbnail' as const, width: 320, height: 240, quality: 78},
  {kind: 'card' as const, width: 720, height: 540, quality: 80},
  {kind: 'detail' as const, width: 1600, height: 1200, quality: 82}
];

export interface ProcessedVariant {
  kind: (typeof variants)[number]['kind'];
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type MediaProcessingOutcome = 'ready' | 'rejected' | 'retried' | 'lease_lost';

export interface MediaBatchResult {
  claimed: number;
  processed: number;
  rejected: number;
  retried: number;
  leaseLost: number;
}

export interface MediaRetentionResult {
  expiredUploads: number;
  quarantinesDeleted: number;
  variantsDeleted: number;
  failures: number;
}

export interface MediaWorkerHealth {
  statusCounts: {
    pendingUpload: number;
    quarantined: number;
    processing: number;
    ready: number;
    rejected: number;
    deleted: number;
  };
  processable: number;
  retriesWaiting: number;
  expiredLeases: number;
  expiredUploads: number;
  quarantineCleanupPending: number;
  oldestProcessableAt: string | null;
  healthy: boolean;
}

interface ClaimedMediaAsset {
  id: string;
  ownerId: string;
  quarantineObjectKey: string;
  attempt: number;
  workerId: string;
}

interface MediaBatchOptions {
  storage?: MediaProcessingStorage;
  workerId?: string;
  now?: Date;
}

interface MediaRetentionOptions {
  limit?: number;
  ownerId?: string;
}

export async function createSafeImageVariants(input: Uint8Array): Promise<{
  width: number;
  height: number;
  variants: ProcessedVariant[];
}> {
  const image = sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true
  });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new AppError('BAD_REQUEST', 'Image dimensions could not be determined', 422);
  }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) {
    throw new AppError('BAD_REQUEST', 'Image format is not supported for processing', 415);
  }
  if (
    metadata.width > MAX_IMAGE_DIMENSION ||
    metadata.height > MAX_IMAGE_DIMENSION ||
    metadata.width * metadata.height > MAX_INPUT_PIXELS
  ) {
    throw new AppError('BAD_REQUEST', 'Image dimensions exceed the safety limit', 413);
  }

  const orientationSwapsDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = orientationSwapsDimensions ? metadata.height : metadata.width;
  const height = orientationSwapsDimensions ? metadata.width : metadata.height;
  const outputs = await Promise.all(
    variants.map(async (variant) => {
      const {data, info} = await image
        .clone()
        .rotate()
        .resize({
          width: variant.width,
          height: variant.height,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({quality: variant.quality, effort: 4, smartSubsample: true})
        .toBuffer({resolveWithObject: true});
      return {
        kind: variant.kind,
        bytes: new Uint8Array(data),
        width: info.width,
        height: info.height
      };
    })
  );
  return {width, height, variants: outputs};
}

export function mediaRetryDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(MEDIA_RETRY_MAX_DELAY_MS, 2 ** Math.min(normalizedAttempt, 12) * 1000);
}

export async function processMediaAsset(
  db: DatabaseClient,
  assetId: string,
  storage: MediaProcessingStorage = getMediaStorage()
): Promise<MediaProcessingOutcome> {
  const workerId = `media-manual-${randomUUID()}`;
  const claim = await claimNextMediaAsset(db, workerId, new Date(), assetId);
  if (!claim) throw new AppError('CONFLICT', 'Media asset is not ready for processing', 409);
  return processClaimedMediaAsset(db, claim, storage);
}

export async function processNextMediaBatch(
  db: DatabaseClient,
  limit = 10,
  options: MediaBatchOptions = {}
): Promise<MediaBatchResult> {
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const storage = options.storage ?? getMediaStorage();
  const workerId = options.workerId ?? `media-batch-${randomUUID()}`;
  const result: MediaBatchResult = {
    claimed: 0,
    processed: 0,
    rejected: 0,
    retried: 0,
    leaseLost: 0
  };

  for (let index = 0; index < boundedLimit; index += 1) {
    const claim = await claimNextMediaAsset(db, workerId, options.now ?? new Date());
    if (!claim) break;
    result.claimed += 1;
    const outcome = await processClaimedMediaAsset(db, claim, storage);
    if (outcome === 'ready') result.processed += 1;
    if (outcome === 'rejected') result.rejected += 1;
    if (outcome === 'retried') result.retried += 1;
    if (outcome === 'lease_lost') result.leaseLost += 1;
  }
  return result;
}

export async function cleanupMediaRetention(
  db: DatabaseClient,
  storage: MediaProcessingStorage = getMediaStorage(),
  now = new Date(),
  options: MediaRetentionOptions = {}
): Promise<MediaRetentionResult> {
  const boundedLimit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const ownerScope = options.ownerId ? eq(mediaAsset.ownerId, options.ownerId) : undefined;
  const result: MediaRetentionResult = {
    expiredUploads: 0,
    quarantinesDeleted: 0,
    variantsDeleted: 0,
    failures: 0
  };

  const expiredUploads = await db.transaction(async (transaction) => {
    const rows = await transaction
      .select({id: mediaAsset.id, quarantineObjectKey: mediaAsset.quarantineObjectKey})
      .from(mediaAsset)
      .where(
        and(
          eq(mediaAsset.status, 'pending_upload'),
          lte(mediaAsset.uploadExpiresAt, now),
          ownerScope
        )
      )
      .orderBy(asc(mediaAsset.uploadExpiresAt))
      .limit(boundedLimit)
      .for('update', {skipLocked: true});
    for (const row of rows) {
      await transaction
        .update(mediaAsset)
        .set({status: 'deleted', updatedAt: now})
        .where(and(eq(mediaAsset.id, row.id), eq(mediaAsset.status, 'pending_upload')));
    }
    return rows;
  });

  result.expiredUploads = expiredUploads.length;
  for (const asset of expiredUploads) {
    const deleted = await deleteQuarantineAndMark(db, storage, asset, now);
    if (deleted) result.quarantinesDeleted += 1;
    else result.failures += 1;
  }

  const cleanupCutoff = new Date(now.getTime() - MEDIA_QUARANTINE_CLEANUP_GRACE_MS);
  const terminalQuarantines = await db
    .select({id: mediaAsset.id, quarantineObjectKey: mediaAsset.quarantineObjectKey})
    .from(mediaAsset)
    .where(
      and(
        inArray(mediaAsset.status, ['ready', 'rejected', 'deleted']),
        isNull(mediaAsset.quarantineDeletedAt),
        lte(mediaAsset.updatedAt, cleanupCutoff),
        ownerScope
      )
    )
    .orderBy(asc(mediaAsset.updatedAt))
    .limit(boundedLimit);
  for (const asset of terminalQuarantines) {
    const deleted = await deleteQuarantineAndMark(db, storage, asset, now);
    if (deleted) result.quarantinesDeleted += 1;
    else result.failures += 1;
  }

  const deletedVariants = await db
    .select({
      mediaAssetId: mediaVariant.mediaAssetId,
      kind: mediaVariant.kind,
      objectKey: mediaVariant.objectKey
    })
    .from(mediaVariant)
    .innerJoin(
      mediaAsset,
      and(
        eq(mediaAsset.id, mediaVariant.mediaAssetId),
        eq(mediaAsset.status, 'deleted'),
        ownerScope
      )
    )
    .orderBy(asc(mediaVariant.updatedAt))
    .limit(boundedLimit);
  for (const variant of deletedVariants) {
    try {
      await storage.deleteVariant(variant.objectKey);
      await db
        .delete(mediaVariant)
        .where(
          and(
            eq(mediaVariant.mediaAssetId, variant.mediaAssetId),
            eq(mediaVariant.kind, variant.kind),
            eq(mediaVariant.objectKey, variant.objectKey)
          )
        );
      result.variantsDeleted += 1;
    } catch {
      result.failures += 1;
    }
  }

  return result;
}

export async function getMediaWorkerHealth(
  db: DatabaseClient,
  now = new Date(),
  ownerId?: string
): Promise<MediaWorkerHealth> {
  const cleanupCutoff = new Date(now.getTime() - MEDIA_QUARANTINE_CLEANUP_GRACE_MS);
  const nowValue = now.toISOString();
  const cleanupCutoffValue = cleanupCutoff.toISOString();
  const [snapshot] = await db
    .select({
      pendingUpload: sql<number>`count(*) filter (where ${mediaAsset.status} = 'pending_upload')::int`,
      quarantined: sql<number>`count(*) filter (where ${mediaAsset.status} = 'quarantined')::int`,
      processing: sql<number>`count(*) filter (where ${mediaAsset.status} = 'processing')::int`,
      ready: sql<number>`count(*) filter (where ${mediaAsset.status} = 'ready')::int`,
      rejected: sql<number>`count(*) filter (where ${mediaAsset.status} = 'rejected')::int`,
      deleted: sql<number>`count(*) filter (where ${mediaAsset.status} = 'deleted')::int`,
      processable: sql<number>`count(*) filter (where ${mediaAsset.status} = 'quarantined' and ${mediaAsset.processingAvailableAt} <= ${nowValue}::timestamptz)::int`,
      retriesWaiting: sql<number>`count(*) filter (where ${mediaAsset.status} = 'quarantined' and ${mediaAsset.processingAttempts} > 0 and ${mediaAsset.processingAvailableAt} > ${nowValue}::timestamptz)::int`,
      expiredLeases: sql<number>`count(*) filter (where ${mediaAsset.status} = 'processing' and ${mediaAsset.processingLeaseExpiresAt} <= ${nowValue}::timestamptz)::int`,
      expiredUploads: sql<number>`count(*) filter (where ${mediaAsset.status} = 'pending_upload' and ${mediaAsset.uploadExpiresAt} <= ${nowValue}::timestamptz)::int`,
      quarantineCleanupPending: sql<number>`count(*) filter (where ${mediaAsset.status} in ('ready', 'rejected', 'deleted') and ${mediaAsset.quarantineDeletedAt} is null and ${mediaAsset.updatedAt} <= ${cleanupCutoffValue}::timestamptz)::int`,
      oldestProcessableAt: sql<string | null>`min(${mediaAsset.processingAvailableAt}) filter (where ${mediaAsset.status} = 'quarantined' and ${mediaAsset.processingAvailableAt} <= ${nowValue}::timestamptz)`
    })
    .from(mediaAsset)
    .where(ownerId ? eq(mediaAsset.ownerId, ownerId) : undefined);

  const oldestProcessableAt = snapshot?.oldestProcessableAt
    ? new Date(snapshot.oldestProcessableAt)
    : null;
  const healthy =
    (snapshot?.expiredLeases ?? 0) === 0 &&
    (!oldestProcessableAt || now.getTime() - oldestProcessableAt.getTime() <= MEDIA_BACKLOG_SLA_MS);

  return {
    statusCounts: {
      pendingUpload: snapshot?.pendingUpload ?? 0,
      quarantined: snapshot?.quarantined ?? 0,
      processing: snapshot?.processing ?? 0,
      ready: snapshot?.ready ?? 0,
      rejected: snapshot?.rejected ?? 0,
      deleted: snapshot?.deleted ?? 0
    },
    processable: snapshot?.processable ?? 0,
    retriesWaiting: snapshot?.retriesWaiting ?? 0,
    expiredLeases: snapshot?.expiredLeases ?? 0,
    expiredUploads: snapshot?.expiredUploads ?? 0,
    quarantineCleanupPending: snapshot?.quarantineCleanupPending ?? 0,
    oldestProcessableAt: oldestProcessableAt?.toISOString() ?? null,
    healthy
  };
}

async function claimNextMediaAsset(
  db: DatabaseClient,
  workerId: string,
  now: Date,
  assetId?: string
): Promise<ClaimedMediaAsset | null> {
  const eligibility = or(
    and(eq(mediaAsset.status, 'quarantined'), lte(mediaAsset.processingAvailableAt, now)),
    and(eq(mediaAsset.status, 'processing'), lte(mediaAsset.processingLeaseExpiresAt, now))
  );
  return db.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({
        id: mediaAsset.id,
        ownerId: mediaAsset.ownerId,
        quarantineObjectKey: mediaAsset.quarantineObjectKey,
        processingAttempts: mediaAsset.processingAttempts
      })
      .from(mediaAsset)
      .where(assetId ? and(eq(mediaAsset.id, assetId), eligibility) : eligibility)
      .orderBy(
        asc(mediaAsset.processingAvailableAt),
        asc(mediaAsset.uploadedAt),
        asc(mediaAsset.createdAt)
      )
      .limit(1)
      .for('update', {skipLocked: true});
    if (!candidate) return null;
    const leaseExpiresAt = new Date(now.getTime() + MEDIA_PROCESSING_LEASE_MS);
    await transaction
      .update(mediaAsset)
      .set({
        status: 'processing',
        processingAttempts: sql`${mediaAsset.processingAttempts} + 1`,
        processingLeaseOwner: workerId,
        processingLeaseExpiresAt: leaseExpiresAt,
        updatedAt: now
      })
      .where(eq(mediaAsset.id, candidate.id));
    return {
      id: candidate.id,
      ownerId: candidate.ownerId,
      quarantineObjectKey: candidate.quarantineObjectKey,
      attempt: candidate.processingAttempts + 1,
      workerId
    };
  });
}

async function processClaimedMediaAsset(
  db: DatabaseClient,
  asset: ClaimedMediaAsset,
  storage: MediaProcessingStorage
): Promise<MediaProcessingOutcome> {
  let input: Uint8Array;
  try {
    input = await storage.readQuarantine(asset.quarantineObjectKey);
  } catch {
    return scheduleRetry(db, asset, 'quarantine_read_failed');
  }

  let processed: Awaited<ReturnType<typeof createSafeImageVariants>>;
  try {
    processed = await createSafeImageVariants(input);
  } catch (error) {
    return rejectClaim(db, storage, asset, rejectionCode(error));
  }

  let stored: Array<ProcessedVariant & {objectKey: string}>;
  try {
    stored = await Promise.all(
      processed.variants.map(async (variant) => {
        const objectKey = `${asset.ownerId}/${asset.id}/${variant.kind}.webp`;
        await storage.putVariant(objectKey, variant.bytes);
        return {...variant, objectKey};
      })
    );
  } catch {
    return scheduleRetry(db, asset, 'variant_write_failed');
  }

  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      const [ready] = await transaction
        .update(mediaAsset)
        .set({
          status: 'ready',
          width: processed.width,
          height: processed.height,
          processedAt: now,
          rejectionCode: null,
          processingLeaseOwner: null,
          processingLeaseExpiresAt: null,
          lastProcessingErrorCode: null,
          updatedAt: now
        })
        .where(
          and(
            eq(mediaAsset.id, asset.id),
            eq(mediaAsset.status, 'processing'),
            eq(mediaAsset.processingLeaseOwner, asset.workerId)
          )
        )
        .returning({id: mediaAsset.id});
      if (!ready) throw new AppError('CONFLICT', 'Media processing lease was lost', 409);
      await transaction.delete(mediaVariant).where(eq(mediaVariant.mediaAssetId, asset.id));
      await transaction.insert(mediaVariant).values(
        stored.map((variant) => ({
          mediaAssetId: asset.id,
          kind: variant.kind,
          objectKey: variant.objectKey,
          mediaType: 'image/webp',
          bytes: variant.bytes.byteLength,
          width: variant.width,
          height: variant.height
        }))
      );
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'CONFLICT') return 'lease_lost';
    return scheduleRetry(db, asset, 'state_finalize_failed');
  }

  await deleteQuarantineAndMark(db, storage, asset, new Date());
  return 'ready';
}

async function rejectClaim(
  db: DatabaseClient,
  storage: MediaProcessingStorage,
  asset: ClaimedMediaAsset,
  code: string
): Promise<MediaProcessingOutcome> {
  const now = new Date();
  const [rejected] = await db
    .update(mediaAsset)
    .set({
      status: 'rejected',
      rejectionCode: code,
      processedAt: now,
      processingLeaseOwner: null,
      processingLeaseExpiresAt: null,
      lastProcessingErrorCode: null,
      updatedAt: now
    })
    .where(
      and(
        eq(mediaAsset.id, asset.id),
        eq(mediaAsset.status, 'processing'),
        eq(mediaAsset.processingLeaseOwner, asset.workerId)
      )
    )
    .returning({id: mediaAsset.id});
  if (!rejected) return 'lease_lost';
  await deleteQuarantineAndMark(db, storage, asset, new Date());
  return 'rejected';
}

async function scheduleRetry(
  db: DatabaseClient,
  asset: ClaimedMediaAsset,
  code: string
): Promise<MediaProcessingOutcome> {
  const now = new Date();
  const [released] = await db
    .update(mediaAsset)
    .set({
      status: 'quarantined',
      processingAvailableAt: new Date(now.getTime() + mediaRetryDelayMs(asset.attempt)),
      processingLeaseOwner: null,
      processingLeaseExpiresAt: null,
      lastProcessingErrorCode: code,
      updatedAt: now
    })
    .where(
      and(
        eq(mediaAsset.id, asset.id),
        eq(mediaAsset.status, 'processing'),
        eq(mediaAsset.processingLeaseOwner, asset.workerId)
      )
    )
    .returning({id: mediaAsset.id});
  return released ? 'retried' : 'lease_lost';
}

async function deleteQuarantineAndMark(
  db: DatabaseClient,
  storage: MediaProcessingStorage,
  asset: {id: string; quarantineObjectKey: string},
  now: Date
): Promise<boolean> {
  try {
    await storage.deleteQuarantine(asset.quarantineObjectKey);
    await db
      .update(mediaAsset)
      .set({quarantineDeletedAt: now})
      .where(and(eq(mediaAsset.id, asset.id), isNull(mediaAsset.quarantineDeletedAt)));
    return true;
  } catch {
    return false;
  }
}

function rejectionCode(error: unknown): string {
  if (error instanceof AppError) return `validation_${error.status}`;
  return 'decoder_failure';
}
