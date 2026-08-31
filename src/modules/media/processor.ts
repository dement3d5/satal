import {and, asc, eq} from 'drizzle-orm';
import sharp from 'sharp';

import type {DatabaseClient} from '@/server/db/client';
import {mediaAsset, mediaVariant} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {getMediaStorage, type MediaProcessingStorage} from './storage';

const MAX_IMAGE_DIMENSION = 12_000;
const MAX_INPUT_PIXELS = 40_000_000;
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

export async function processMediaAsset(
  db: DatabaseClient,
  assetId: string,
  storage: MediaProcessingStorage = getMediaStorage()
): Promise<void> {
  const asset = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(mediaAsset)
      .where(eq(mediaAsset.id, assetId))
      .for('update')
      .limit(1);
    if (!candidate) throw new AppError('NOT_FOUND', 'Media asset was not found', 404);
    if (candidate.status !== 'quarantined') {
      throw new AppError('CONFLICT', 'Media asset is not awaiting processing', 409);
    }
    await tx
      .update(mediaAsset)
      .set({status: 'processing', updatedAt: new Date()})
      .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.status, 'quarantined')));
    return candidate;
  });

  try {
    const input = await storage.readQuarantine(asset.quarantineObjectKey);
    const processed = await createSafeImageVariants(input);
    const stored = await Promise.all(
      processed.variants.map(async (variant) => {
        const objectKey = `${asset.ownerId}/${asset.id}/${variant.kind}.webp`;
        await storage.putVariant(objectKey, variant.bytes);
        return {...variant, objectKey};
      })
    );
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(mediaVariant).values(
        stored.map((variant) => ({
          mediaAssetId: assetId,
          kind: variant.kind,
          objectKey: variant.objectKey,
          mediaType: 'image/webp',
          bytes: variant.bytes.byteLength,
          width: variant.width,
          height: variant.height
        }))
      );
      const [ready] = await tx
        .update(mediaAsset)
        .set({
          status: 'ready',
          width: processed.width,
          height: processed.height,
          processedAt: now,
          updatedAt: now
        })
        .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.status, 'processing')))
        .returning({id: mediaAsset.id});
      if (!ready) throw new AppError('CONFLICT', 'Media state changed during processing', 409);
    });
    await storage.deleteQuarantine(asset.quarantineObjectKey).catch(() => undefined);
  } catch (error) {
    await db
      .update(mediaAsset)
      .set({status: 'rejected', rejectionCode: rejectionCode(error), updatedAt: new Date()})
      .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.status, 'processing')));
    await storage.deleteQuarantine(asset.quarantineObjectKey).catch(() => undefined);
    throw error;
  }
}

export async function processNextMediaBatch(
  db: DatabaseClient,
  limit = 10
): Promise<{processed: number; rejected: number}> {
  const rows = await db
    .select({id: mediaAsset.id})
    .from(mediaAsset)
    .where(eq(mediaAsset.status, 'quarantined'))
    .orderBy(asc(mediaAsset.uploadedAt))
    .limit(Math.max(1, Math.min(limit, 50)));
  let processed = 0;
  let rejected = 0;
  for (const row of rows) {
    try {
      await processMediaAsset(db, row.id);
      processed += 1;
    } catch (error) {
      if (!(error instanceof AppError && error.code === 'CONFLICT')) rejected += 1;
    }
  }
  return {processed, rejected};
}

function rejectionCode(error: unknown): string {
  if (error instanceof AppError) return `validation_${error.status}`;
  return 'decoder_failure';
}
