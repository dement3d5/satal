import {randomUUID} from 'node:crypto';

import {and, asc, desc, eq, gt, inArray, isNull, or, sql} from 'drizzle-orm';

import type {AppLocale} from '@/i18n/routing';
import {getPublicListingCardsByIds} from '@/modules/listings/public-listing-service';
import type {DatabaseClient} from '@/server/db/client';
import {
  listing,
  location,
  locationTranslation,
  mediaAsset,
  shop,
  shopBusinessHour,
  shopMedia,
  shopMember,
  shopVerificationRequest,
  user,
  userRole
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {
  CreateShopInput,
  DecideShopVerificationInput,
  SubmitShopVerificationInput,
  UpdateShopInput
} from './contracts';
import {
  assertBusinessHours,
  assertShopCapability,
  slugifyShopName,
  type ShopCapability,
  type ShopMemberRole
} from './domain';

type QueryExecutor = Pick<DatabaseClient, 'select'>;

export interface ShopContract {
  id: string;
  slug: string;
  name: string;
  description: string;
  locationId: string | null;
  publicAddress: string | null;
  publicPhone: string | null;
  status: 'active' | 'suspended' | 'closed';
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verifiedAt: string | null;
  version: number;
  role: ShopMemberRole;
  logoUrl: string | null;
  coverUrl: string | null;
  businessHours: BusinessHourContract[];
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHourContract {
  weekday: number;
  isClosed: boolean;
  opensAtMinute: number | null;
  closesAtMinute: number | null;
}

export async function createShop(
  db: DatabaseClient,
  actorId: string,
  input: CreateShopInput
): Promise<ShopContract> {
  assertBusinessHours(input.businessHours);
  const createdId = await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({id: shop.id})
      .from(shop)
      .where(eq(shop.ownerId, actorId))
      .limit(1);
    if (owned) throw new AppError('CONFLICT', 'This account already owns a shop', 409);
    await assertLocationAvailable(tx, input.locationId ?? null);

    const baseSlug = slugifyShopName(input.name);
    const [collision] = await tx
      .select({id: shop.id})
      .from(shop)
      .where(eq(shop.slug, baseSlug))
      .limit(1);
    const slug = collision ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;
    const [created] = await tx
      .insert(shop)
      .values({
        ownerId: actorId,
        slug,
        name: input.name,
        description: input.description,
        locationId: input.locationId ?? null,
        publicAddress: emptyToNull(input.publicAddress),
        publicPhone: emptyToNull(input.publicPhone)
      })
      .returning({id: shop.id});
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Shop could not be created', 500);
    await tx.insert(shopMember).values({shopId: created.id, userId: actorId, role: 'owner'});
    await replaceBusinessHours(tx, created.id, input.businessHours);
    return created.id;
  });
  return getManagedShop(db, actorId, createdId);
}

export async function listMyShops(db: DatabaseClient, actorId: string): Promise<ShopContract[]> {
  const rows = await db
    .select({id: shop.id})
    .from(shopMember)
    .innerJoin(shop, eq(shop.id, shopMember.shopId))
    .where(eq(shopMember.userId, actorId))
    .orderBy(asc(shop.name));
  return Promise.all(rows.map((row) => getManagedShop(db, actorId, row.id)));
}

export async function getManagedShop(
  db: DatabaseClient,
  actorId: string,
  shopId: string
): Promise<ShopContract> {
  const [row] = await db
    .select({
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      description: shop.description,
      locationId: shop.locationId,
      publicAddress: shop.publicAddress,
      publicPhone: shop.publicPhone,
      status: shop.status,
      verificationStatus: shop.verificationStatus,
      verifiedAt: shop.verifiedAt,
      version: shop.version,
      role: shopMember.role,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt
    })
    .from(shop)
    .innerJoin(shopMember, and(eq(shopMember.shopId, shop.id), eq(shopMember.userId, actorId)))
    .where(eq(shop.id, shopId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Shop was not found', 404);
  const [businessHours, media] = await Promise.all([
    loadBusinessHours(db, shopId),
    loadShopMedia(db, shopId)
  ]);
  return {
    ...row,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    logoUrl: media.logo ?? null,
    coverUrl: media.cover ?? null,
    businessHours
  };
}

export async function updateShop(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  input: UpdateShopInput
): Promise<ShopContract> {
  assertBusinessHours(input.businessHours ?? []);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from shop where id = ${shopId} for update`);
    const membership = await requireShopCapability(tx, actorId, shopId, 'profile:manage');
    if (membership.version !== input.version) {
      throw new AppError('CONFLICT', 'Shop was changed by another session', 409);
    }
    await assertLocationAvailable(tx, input.locationId);
    const identityChanged =
      input.name !== undefined ||
      input.locationId !== undefined ||
      input.publicAddress !== undefined ||
      input.publicPhone !== undefined;
    const resetVerification =
      identityChanged &&
      (membership.verificationStatus === 'verified' || membership.verificationStatus === 'pending');
    if (resetVerification && membership.verificationStatus === 'pending') {
      await tx
        .update(shopVerificationRequest)
        .set({status: 'cancelled', resolvedAt: new Date(), updatedAt: new Date()})
        .where(
          and(
            eq(shopVerificationRequest.shopId, shopId),
            eq(shopVerificationRequest.status, 'pending')
          )
        );
    }
    const [updated] = await tx
      .update(shop)
      .set({
        ...(input.name !== undefined ? {name: input.name} : {}),
        ...(input.description !== undefined ? {description: input.description} : {}),
        ...(input.locationId !== undefined ? {locationId: input.locationId} : {}),
        ...(input.publicAddress !== undefined
          ? {publicAddress: emptyToNull(input.publicAddress)}
          : {}),
        ...(input.publicPhone !== undefined ? {publicPhone: emptyToNull(input.publicPhone)} : {}),
        ...(resetVerification
          ? {
              verificationStatus: 'unverified' as const,
              verifiedAt: null,
              verificationReviewedBy: null
            }
          : {}),
        version: membership.version + 1,
        updatedAt: new Date()
      })
      .where(and(eq(shop.id, shopId), eq(shop.version, membership.version)))
      .returning({id: shop.id});
    if (!updated) throw new AppError('CONFLICT', 'Shop was changed by another session', 409);
    if (input.businessHours) await replaceBusinessHours(tx, shopId, input.businessHours);
  });
  return getManagedShop(db, actorId, shopId);
}

export async function listShopMembers(db: DatabaseClient, actorId: string, shopId: string) {
  await requireShopCapability(db, actorId, shopId, 'members:manage');
  const rows = await db
    .select({userId: user.id, name: user.name, email: user.email, role: shopMember.role})
    .from(shopMember)
    .innerJoin(user, eq(user.id, shopMember.userId))
    .where(eq(shopMember.shopId, shopId))
    .orderBy(asc(shopMember.createdAt));
  return rows;
}

export async function addShopMember(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  input: {email: string; role: 'manager' | 'listing_manager'}
) {
  await requireShopCapability(db, actorId, shopId, 'members:manage');
  const [memberUser] = await db
    .select({id: user.id, name: user.name, email: user.email})
    .from(user)
    .where(eq(user.email, input.email.toLowerCase()))
    .limit(1);
  if (!memberUser) throw new AppError('NOT_FOUND', 'No account uses this email address', 404);
  const [targetShop] = await db
    .select({ownerId: shop.ownerId})
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1);
  if (!targetShop) throw new AppError('NOT_FOUND', 'Shop was not found', 404);
  if (memberUser.id === targetShop.ownerId) {
    throw new AppError('CONFLICT', 'The shop owner role cannot be changed', 409);
  }
  await db
    .insert(shopMember)
    .values({shopId, userId: memberUser.id, role: input.role, invitedBy: actorId})
    .onConflictDoUpdate({
      target: [shopMember.shopId, shopMember.userId],
      set: {role: input.role, invitedBy: actorId, updatedAt: new Date()}
    });
  return {...memberUser, role: input.role};
}

export async function removeShopMember(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  memberUserId: string
): Promise<void> {
  await requireShopCapability(db, actorId, shopId, 'members:manage');
  const [targetShop] = await db
    .select({ownerId: shop.ownerId})
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1);
  if (!targetShop) throw new AppError('NOT_FOUND', 'Shop was not found', 404);
  if (memberUserId === targetShop.ownerId) {
    throw new AppError('CONFLICT', 'The shop owner cannot be removed', 409);
  }
  await db
    .delete(shopMember)
    .where(and(eq(shopMember.shopId, shopId), eq(shopMember.userId, memberUserId)));
}

export async function submitShopVerification(
  db: DatabaseClient,
  actorId: string,
  shopId: string,
  input: SubmitShopVerificationInput
) {
  return db.transaction(async (tx) => {
    const membership = await requireShopCapability(tx, actorId, shopId, 'verification:submit');
    if (membership.status !== 'active') {
      throw new AppError('CONFLICT', 'Only active shops can request verification', 409);
    }
    if (!membership.locationId || !membership.publicAddress || !membership.publicPhone) {
      throw new AppError(
        'BAD_REQUEST',
        'Add a public location, address and phone before requesting verification',
        400
      );
    }
    if (membership.verificationStatus === 'pending') {
      throw new AppError('CONFLICT', 'A verification request is already pending', 409);
    }
    const [created] = await tx
      .insert(shopVerificationRequest)
      .values({
        shopId,
        submittedBy: actorId,
        legalName: input.legalName,
        registryNumber: emptyToNull(input.registryNumber),
        statement: input.statement
      })
      .returning();
    if (!created)
      throw new AppError('UNEXPECTED_ERROR', 'Verification request could not be created', 500);
    await tx
      .update(shop)
      .set({verificationStatus: 'pending', verifiedAt: null, updatedAt: new Date()})
      .where(eq(shop.id, shopId));
    return toVerificationContract(created);
  });
}

export async function listVerificationQueue(db: DatabaseClient, actorId: string) {
  await requireVerificationReviewer(db, actorId);
  const rows = await db
    .select({
      id: shopVerificationRequest.id,
      shopId: shop.id,
      shopName: shop.name,
      shopSlug: shop.slug,
      legalName: shopVerificationRequest.legalName,
      registryNumber: shopVerificationRequest.registryNumber,
      statement: shopVerificationRequest.statement,
      submittedBy: shopVerificationRequest.submittedBy,
      createdAt: shopVerificationRequest.createdAt
    })
    .from(shopVerificationRequest)
    .innerJoin(shop, eq(shop.id, shopVerificationRequest.shopId))
    .where(eq(shopVerificationRequest.status, 'pending'))
    .orderBy(asc(shopVerificationRequest.createdAt));
  return rows.map((row) => ({...row, createdAt: row.createdAt.toISOString()}));
}

export async function decideShopVerification(
  db: DatabaseClient,
  actorId: string,
  requestId: string,
  input: DecideShopVerificationInput
) {
  await requireVerificationReviewer(db, actorId);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from shop_verification_request where id = ${requestId} for update`
    );
    const [request] = await tx
      .select()
      .from(shopVerificationRequest)
      .where(eq(shopVerificationRequest.id, requestId))
      .limit(1);
    if (!request) throw new AppError('NOT_FOUND', 'Verification request was not found', 404);
    if (request.status !== 'pending') {
      throw new AppError('CONFLICT', 'Verification request is already resolved', 409);
    }
    const now = new Date();
    const nextRequestStatus = input.decision === 'approve' ? 'approved' : 'rejected';
    const nextShopStatus = input.decision === 'approve' ? 'verified' : 'rejected';
    const [updated] = await tx
      .update(shopVerificationRequest)
      .set({
        status: nextRequestStatus,
        reviewedBy: actorId,
        reviewerNote: input.reviewerNote,
        resolvedAt: now,
        updatedAt: now
      })
      .where(eq(shopVerificationRequest.id, requestId))
      .returning();
    await tx
      .update(shop)
      .set({
        verificationStatus: nextShopStatus,
        verifiedAt: input.decision === 'approve' ? now : null,
        verificationReviewedBy: actorId,
        updatedAt: now
      })
      .where(eq(shop.id, request.shopId));
    return toVerificationContract(updated!);
  });
}

export async function getPublicShop(db: DatabaseClient, locale: AppLocale, slug: string) {
  const [row] = await db
    .select({
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      description: shop.description,
      locationName: locationTranslation.name,
      publicAddress: shop.publicAddress,
      publicPhone: shop.publicPhone,
      verificationStatus: shop.verificationStatus,
      verifiedAt: shop.verifiedAt,
      createdAt: shop.createdAt
    })
    .from(shop)
    .leftJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, shop.locationId),
        eq(locationTranslation.locale, locale)
      )
    )
    .where(and(eq(shop.slug, slug), eq(shop.status, 'active')))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Shop was not found', 404);
  const [hours, media, listingRows] = await Promise.all([
    loadBusinessHours(db, row.id),
    loadShopMedia(db, row.id),
    db
      .select({id: listing.id})
      .from(listing)
      .where(and(eq(listing.shopId, row.id), eq(listing.status, 'active')))
      .orderBy(desc(listing.publishedAt), desc(listing.id))
      .limit(48)
  ]);
  const listings = await getPublicListingCardsByIds(
    db,
    locale,
    listingRows.map((item) => item.id)
  );
  return {
    ...row,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    logoUrl: media.logo ?? null,
    coverUrl: media.cover ?? null,
    businessHours: hours,
    listings
  };
}

export async function requireShopCapability(
  executor: QueryExecutor,
  actorId: string,
  shopId: string,
  capability: ShopCapability
) {
  const [row] = await executor
    .select({
      role: shopMember.role,
      status: shop.status,
      verificationStatus: shop.verificationStatus,
      locationId: shop.locationId,
      publicAddress: shop.publicAddress,
      publicPhone: shop.publicPhone,
      version: shop.version
    })
    .from(shopMember)
    .innerJoin(shop, eq(shop.id, shopMember.shopId))
    .where(and(eq(shopMember.shopId, shopId), eq(shopMember.userId, actorId)))
    .limit(1);
  if (!row) throw new AppError('FORBIDDEN', 'Shop membership is required', 403);
  assertShopCapability(row.role, capability);
  return row;
}

async function requireVerificationReviewer(
  executor: QueryExecutor,
  actorId: string
): Promise<void> {
  const roles = await executor
    .select({role: userRole.role})
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, actorId),
        inArray(userRole.role, ['admin', 'owner']),
        or(isNull(userRole.expiresAt), gt(userRole.expiresAt, new Date()))
      )
    );
  if (!roles.length) throw new AppError('FORBIDDEN', 'Admin access is required', 403);
}

async function assertLocationAvailable(
  executor: QueryExecutor,
  locationId: string | null | undefined
): Promise<void> {
  if (locationId === undefined || locationId === null) return;
  const [row] = await executor
    .select({id: location.id})
    .from(location)
    .where(and(eq(location.id, locationId), eq(location.enabled, true)))
    .limit(1);
  if (!row) throw new AppError('BAD_REQUEST', 'Location is not available', 400);
}

async function replaceBusinessHours(
  tx: Parameters<Parameters<DatabaseClient['transaction']>[0]>[0],
  shopId: string,
  hours: CreateShopInput['businessHours'] | NonNullable<UpdateShopInput['businessHours']>
): Promise<void> {
  await tx.delete(shopBusinessHour).where(eq(shopBusinessHour.shopId, shopId));
  if (!hours.length) return;
  await tx.insert(shopBusinessHour).values(
    hours.map((item) => ({
      shopId,
      weekday: item.weekday,
      isClosed: item.isClosed,
      opensAtMinute: item.isClosed ? null : item.opensAtMinute,
      closesAtMinute: item.isClosed ? null : item.closesAtMinute
    }))
  );
}

async function loadBusinessHours(
  executor: QueryExecutor,
  shopId: string
): Promise<BusinessHourContract[]> {
  return executor
    .select({
      weekday: shopBusinessHour.weekday,
      isClosed: shopBusinessHour.isClosed,
      opensAtMinute: shopBusinessHour.opensAtMinute,
      closesAtMinute: shopBusinessHour.closesAtMinute
    })
    .from(shopBusinessHour)
    .where(eq(shopBusinessHour.shopId, shopId))
    .orderBy(asc(shopBusinessHour.weekday));
}

async function loadShopMedia(
  executor: QueryExecutor,
  shopId: string
): Promise<Partial<Record<'logo' | 'cover', string>>> {
  const rows = await executor
    .select({kind: shopMedia.kind, assetId: mediaAsset.id})
    .from(shopMedia)
    .innerJoin(mediaAsset, eq(mediaAsset.id, shopMedia.mediaAssetId))
    .where(and(eq(shopMedia.shopId, shopId), eq(mediaAsset.status, 'ready')));
  return Object.fromEntries(
    rows.map((item) => [item.kind, `/api/v1/media/${item.assetId}/variants/detail`])
  );
}

function emptyToNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function toVerificationContract(row: typeof shopVerificationRequest.$inferSelect) {
  return {
    id: row.id,
    shopId: row.shopId,
    status: row.status,
    legalName: row.legalName,
    registryNumber: row.registryNumber,
    statement: row.statement,
    reviewerNote: row.reviewerNote,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null
  };
}
