import {and, eq, ne} from 'drizzle-orm';

import {getMediaStorage, type MediaProcessingStorage} from '@/modules/media/storage';
import type {DatabaseClient} from '@/server/db/client';
import {listing, listingMedia, mediaAsset, mediaVariant, moderationCase} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {hasModerationCapability} from './domain';
import {requireModerationCapability} from './service';

export type ModerationVariantKind = 'thumbnail' | 'detail';

export async function getModerationMediaVariant(
  db: DatabaseClient,
  actorId: string,
  assetId: string,
  kind: ModerationVariantKind,
  storage: MediaProcessingStorage = getMediaStorage()
): Promise<{bytes: Uint8Array; mediaType: string}> {
  const roles = await requireModerationCapability(db, actorId, 'queue:read');
  const canReviewOwnListings = hasModerationCapability(roles, 'listings:self-review');
  const [variant] = await db
    .select({objectKey: mediaVariant.objectKey, mediaType: mediaVariant.mediaType})
    .from(mediaVariant)
    .innerJoin(mediaAsset, eq(mediaAsset.id, mediaVariant.mediaAssetId))
    .innerJoin(listingMedia, eq(listingMedia.mediaAssetId, mediaAsset.id))
    .innerJoin(listing, eq(listing.id, listingMedia.listingId))
    .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .where(
      and(
        eq(mediaAsset.id, assetId),
        eq(mediaAsset.status, 'ready'),
        eq(mediaVariant.kind, kind),
        eq(listing.status, 'pending_review'),
        eq(moderationCase.status, 'open'),
        canReviewOwnListings ? undefined : ne(listing.sellerId, actorId)
      )
    )
    .limit(1);
  if (!variant) throw new AppError('NOT_FOUND', 'Moderation media variant was not found', 404);
  return {bytes: await storage.readVariant(variant.objectKey), mediaType: variant.mediaType};
}
