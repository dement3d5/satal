import {randomUUID} from 'node:crypto';

import {and, eq, sql} from 'drizzle-orm';

import type {AuthorizeMediaUploadInput} from '@/modules/media/contracts';
import {assertUploadRequest} from '@/modules/media/domain';
import {createUploadToken} from '@/modules/media/upload-token';
import type {DatabaseClient} from '@/server/db/client';
import {mediaAsset, shopMedia} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {requireShopCapability} from './service';

const UPLOAD_TTL_MS = 10 * 60 * 1000;

export async function authorizeShopMediaUpload(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  kind: 'logo' | 'cover',
  input: AuthorizeMediaUploadInput,
  now = new Date()
) {
  assertUploadRequest(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from shop where id = ${shopId} for update`);
    const membership = await requireShopCapability(tx, actorId, shopId, 'media:manage');
    if (membership.status !== 'active') {
      throw new AppError('CONFLICT', 'Media cannot change while the shop is inactive', 409);
    }

    const [previous] = await tx
      .select({assetId: shopMedia.mediaAssetId})
      .from(shopMedia)
      .where(and(eq(shopMedia.shopId, shopId), eq(shopMedia.kind, kind)))
      .limit(1);
    if (previous) {
      await tx.delete(shopMedia).where(and(eq(shopMedia.shopId, shopId), eq(shopMedia.kind, kind)));
      await tx
        .update(mediaAsset)
        .set({
          status: 'deleted',
          processingLeaseOwner: null,
          processingLeaseExpiresAt: null,
          updatedAt: now
        })
        .where(eq(mediaAsset.id, previous.assetId));
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
    await tx.insert(shopMedia).values({shopId, kind, mediaAssetId: assetId});
    return {
      media: {assetId, kind, status: 'pending_upload' as const},
      upload: {
        url: `/api/v1/media/${assetId}/content`,
        method: 'PUT' as const,
        token: createUploadToken(assetId, expiresAt),
        expiresAt: expiresAt.toISOString()
      }
    };
  });
}

export async function removeShopMedia(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  kind: 'logo' | 'cover'
): Promise<void> {
  await db.transaction(async (tx) => {
    await requireShopCapability(tx, actorId, shopId, 'media:manage');
    const [attached] = await tx
      .select({assetId: shopMedia.mediaAssetId})
      .from(shopMedia)
      .where(and(eq(shopMedia.shopId, shopId), eq(shopMedia.kind, kind)))
      .limit(1);
    if (!attached) throw new AppError('NOT_FOUND', 'Shop media was not found', 404);
    await tx.delete(shopMedia).where(and(eq(shopMedia.shopId, shopId), eq(shopMedia.kind, kind)));
    await tx
      .update(mediaAsset)
      .set({
        status: 'deleted',
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(mediaAsset.id, attached.assetId));
  });
}
