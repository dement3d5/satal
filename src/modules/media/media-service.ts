import {createHash, randomUUID} from 'node:crypto';

import {and, asc, eq} from 'drizzle-orm';

import {assertDraftOwner} from '@/modules/listings/draft-domain';
import {lockDraft, requireDraft} from '@/modules/listings/draft-service';
import type {DatabaseClient} from '@/server/db/client';
import {listingDraftMedia, mediaAsset, outboxEvent} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {
  ArrangeDraftMediaInput,
  AuthorizeMediaUploadInput,
  DraftMediaContract
} from './contracts';
import {
  assertUploadMatchesAuthorization,
  assertUploadRequest,
  detectImageMediaType,
  MAX_IMAGE_BYTES,
  MAX_LISTING_IMAGES
} from './domain';
import {getQuarantineStorage, type QuarantineStorage} from './storage';
import {createUploadToken, verifyUploadToken} from './upload-token';

const UPLOAD_TTL_MS = 10 * 60 * 1000;

export interface UploadAuthorizationContract {
  media: DraftMediaContract;
  upload: {
    url: string;
    method: 'PUT';
    token: string;
    expiresAt: string;
  };
}

export async function authorizeDraftMediaUpload(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  input: AuthorizeMediaUploadInput,
  now = new Date()
): Promise<UploadAuthorizationContract> {
  assertUploadRequest(input);

  return db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    assertDraftOwner(actorId, draft.ownerId);
    assertDraftEditable(draft.status);

    const attached = await tx
      .select({assetId: listingDraftMedia.mediaAssetId})
      .from(listingDraftMedia)
      .where(eq(listingDraftMedia.draftId, draftId))
      .orderBy(asc(listingDraftMedia.sortOrder));
    if (attached.length >= MAX_LISTING_IMAGES) {
      throw new AppError(
        'CONFLICT',
        `A listing can contain at most ${MAX_LISTING_IMAGES} images`,
        409
      );
    }

    const assetId = randomUUID();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await tx.insert(mediaAsset).values({
      id: assetId,
      ownerId: actorId,
      quarantineObjectKey: `${actorId}/${assetId}/original`,
      declaredMediaType: input.mediaType,
      expectedBytes: input.bytes,
      expectedSha256: input.sha256,
      uploadExpiresAt: expiresAt
    });
    await tx.insert(listingDraftMedia).values({
      draftId,
      mediaAssetId: assetId,
      sortOrder: attached.length,
      isCover: attached.length === 0
    });

    return {
      media: {
        assetId,
        status: 'pending_upload',
        mediaType: input.mediaType,
        bytes: input.bytes,
        sortOrder: attached.length,
        isCover: attached.length === 0
      },
      upload: {
        url: `/api/v1/media/${assetId}/content`,
        method: 'PUT',
        token: createUploadToken(assetId, expiresAt),
        expiresAt: expiresAt.toISOString()
      }
    };
  });
}

export async function listDraftMedia(
  db: DatabaseClient,
  actorId: string,
  draftId: string
): Promise<DraftMediaContract[]> {
  const draft = await requireDraft(db, draftId);
  assertDraftOwner(actorId, draft.ownerId);
  const rows = await db
    .select({
      assetId: mediaAsset.id,
      status: mediaAsset.status,
      mediaType: mediaAsset.declaredMediaType,
      bytes: mediaAsset.expectedBytes,
      sortOrder: listingDraftMedia.sortOrder,
      isCover: listingDraftMedia.isCover
    })
    .from(listingDraftMedia)
    .innerJoin(mediaAsset, eq(mediaAsset.id, listingDraftMedia.mediaAssetId))
    .where(eq(listingDraftMedia.draftId, draftId))
    .orderBy(asc(listingDraftMedia.sortOrder));

  const visible: DraftMediaContract[] = [];
  for (const row of rows) {
    if (row.status !== 'deleted') visible.push({...row, status: row.status});
  }
  return visible;
}

export async function receiveQuarantinedUpload(
  db: DatabaseClient,
  assetId: string,
  token: string,
  bytes: Uint8Array,
  storage: QuarantineStorage = getQuarantineStorage(),
  now = new Date()
): Promise<{assetId: string; status: 'quarantined'}> {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AppError('BAD_REQUEST', 'Image must be between 1 byte and 10 MB', 413);
  }
  verifyUploadToken(token, assetId, now);
  const detectedMediaType = detectImageMediaType(bytes);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');

  return db.transaction(async (tx) => {
    const [asset] = await tx
      .select()
      .from(mediaAsset)
      .where(eq(mediaAsset.id, assetId))
      .for('update')
      .limit(1);
    if (!asset) throw new AppError('NOT_FOUND', 'Media upload was not found', 404);
    if (asset.status !== 'pending_upload') {
      throw new AppError('CONFLICT', 'Media upload has already been consumed', 409);
    }
    if (asset.uploadExpiresAt <= now) {
      throw new AppError('FORBIDDEN', 'Upload authorization has expired', 403);
    }

    assertUploadMatchesAuthorization({
      expectedBytes: asset.expectedBytes,
      actualBytes: bytes.byteLength,
      expectedSha256: asset.expectedSha256,
      actualSha256,
      declaredMediaType: asset.declaredMediaType,
      detectedMediaType
    });

    await storage.put(asset.quarantineObjectKey, bytes);
    await tx
      .update(mediaAsset)
      .set({
        status: 'quarantined',
        detectedMediaType,
        actualBytes: bytes.byteLength,
        actualSha256,
        uploadedAt: now,
        updatedAt: now
      })
      .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.status, 'pending_upload')));
    await tx.insert(outboxEvent).values({
      aggregateType: 'media_asset',
      aggregateId: assetId,
      eventType: 'media.uploaded',
      aggregateVersion: 1,
      payload: {assetId}
    });

    return {assetId, status: 'quarantined'};
  });
}

export async function arrangeDraftMedia(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  input: ArrangeDraftMediaInput
): Promise<DraftMediaContract[]> {
  if (new Set(input.assetIds).size !== input.assetIds.length) {
    throw new AppError('BAD_REQUEST', 'Media order must not contain duplicates', 400);
  }
  if (input.assetIds.length > 0 && !input.coverAssetId) {
    throw new AppError('BAD_REQUEST', 'A cover image is required when media is attached', 400);
  }
  if (input.coverAssetId && !input.assetIds.includes(input.coverAssetId)) {
    throw new AppError('BAD_REQUEST', 'Cover image must belong to the media order', 400);
  }

  await db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    assertDraftOwner(actorId, draft.ownerId);
    assertDraftEditable(draft.status);
    const existing = await tx
      .select({assetId: listingDraftMedia.mediaAssetId})
      .from(listingDraftMedia)
      .where(eq(listingDraftMedia.draftId, draftId));
    if (
      !sameIds(
        existing.map((row) => row.assetId),
        input.assetIds
      )
    ) {
      throw new AppError(
        'BAD_REQUEST',
        'Media order must contain every attached image exactly once',
        400
      );
    }

    await tx.delete(listingDraftMedia).where(eq(listingDraftMedia.draftId, draftId));
    if (input.assetIds.length) {
      await tx.insert(listingDraftMedia).values(
        input.assetIds.map((mediaAssetId, sortOrder) => ({
          draftId,
          mediaAssetId,
          sortOrder,
          isCover: mediaAssetId === input.coverAssetId
        }))
      );
    }
  });
  return listDraftMedia(db, actorId, draftId);
}

export async function removeDraftMedia(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  assetId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    assertDraftOwner(actorId, draft.ownerId);
    assertDraftEditable(draft.status);
    const [attached] = await tx
      .select({isCover: listingDraftMedia.isCover})
      .from(listingDraftMedia)
      .innerJoin(
        mediaAsset,
        and(eq(mediaAsset.id, listingDraftMedia.mediaAssetId), eq(mediaAsset.ownerId, actorId))
      )
      .where(
        and(eq(listingDraftMedia.draftId, draftId), eq(listingDraftMedia.mediaAssetId, assetId))
      )
      .limit(1);
    if (!attached) throw new AppError('NOT_FOUND', 'Draft media was not found', 404);

    await tx
      .delete(listingDraftMedia)
      .where(
        and(eq(listingDraftMedia.draftId, draftId), eq(listingDraftMedia.mediaAssetId, assetId))
      );
    await tx
      .update(mediaAsset)
      .set({status: 'deleted', updatedAt: new Date()})
      .where(eq(mediaAsset.id, assetId));

    const remaining = await tx
      .select({assetId: listingDraftMedia.mediaAssetId, isCover: listingDraftMedia.isCover})
      .from(listingDraftMedia)
      .where(eq(listingDraftMedia.draftId, draftId))
      .orderBy(asc(listingDraftMedia.sortOrder));
    await tx.delete(listingDraftMedia).where(eq(listingDraftMedia.draftId, draftId));
    if (remaining.length) {
      await tx.insert(listingDraftMedia).values(
        remaining.map((row, sortOrder) => ({
          draftId,
          mediaAssetId: row.assetId,
          sortOrder,
          isCover: attached.isCover ? sortOrder === 0 : row.isCover
        }))
      );
    }
  });
}

function assertDraftEditable(status: string): void {
  if (status === 'submitted' || status === 'abandoned') {
    throw new AppError('CONFLICT', 'Media cannot change in the current draft state', 409);
  }
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}
