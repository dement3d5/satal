import {and, eq} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {listing, listingMedia, mediaAsset, mediaVariant} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {getMediaStorage, type MediaProcessingStorage} from './storage';

export type PublicVariantKind = 'thumbnail' | 'card' | 'detail';

export async function getPublicMediaVariant(
  db: DatabaseClient,
  assetId: string,
  kind: PublicVariantKind,
  storage: MediaProcessingStorage = getMediaStorage()
): Promise<{bytes: Uint8Array; mediaType: string}> {
  const [variant] = await db
    .select({objectKey: mediaVariant.objectKey, mediaType: mediaVariant.mediaType})
    .from(mediaVariant)
    .innerJoin(mediaAsset, eq(mediaAsset.id, mediaVariant.mediaAssetId))
    .innerJoin(listingMedia, eq(listingMedia.mediaAssetId, mediaAsset.id))
    .innerJoin(listing, eq(listing.id, listingMedia.listingId))
    .where(
      and(
        eq(mediaAsset.id, assetId),
        eq(mediaAsset.status, 'ready'),
        eq(mediaVariant.kind, kind),
        eq(listing.status, 'active')
      )
    )
    .limit(1);
  if (!variant) throw new AppError('NOT_FOUND', 'Media variant was not found', 404);
  return {bytes: await storage.readVariant(variant.objectKey), mediaType: variant.mediaType};
}
