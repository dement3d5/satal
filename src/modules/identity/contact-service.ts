import {and, count, eq, gte, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {listing, listingContactAccess, user} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

const DISTINCT_CONTACT_LIMIT_PER_HOUR = 30;

export async function revealListingContact(db: DatabaseClient, actorId: string, listingId: string) {
  return db.transaction(async (transaction) => {
    await transaction.select({id: user.id}).from(user).where(eq(user.id, actorId)).for('update');

    const [target] = await transaction
      .select({
        sellerId: listing.sellerId,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified
      })
      .from(listing)
      .innerJoin(user, eq(user.id, listing.sellerId))
      .where(and(eq(listing.id, listingId), eq(listing.status, 'active')))
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    if (target.sellerId === actorId)
      throw new AppError('BAD_REQUEST', 'You cannot request your own contact', 400);
    if (!target.phoneNumber || !target.phoneNumberVerified)
      throw new AppError('CONFLICT', 'Seller contact is not verified yet', 409);

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await transaction
      .select({value: count()})
      .from(listingContactAccess)
      .where(
        and(
          eq(listingContactAccess.buyerId, actorId),
          gte(listingContactAccess.lastAccessedAt, since)
        )
      );
    const [existing] = await transaction
      .select({id: listingContactAccess.id})
      .from(listingContactAccess)
      .where(
        and(
          eq(listingContactAccess.buyerId, actorId),
          eq(listingContactAccess.listingId, listingId)
        )
      )
      .limit(1);
    if (!existing && (recent?.value ?? 0) >= DISTINCT_CONTACT_LIMIT_PER_HOUR)
      throw new AppError('RATE_LIMITED', 'Contact access limit reached', 429);

    await transaction
      .insert(listingContactAccess)
      .values({buyerId: actorId, sellerId: target.sellerId, listingId})
      .onConflictDoUpdate({
        target: [listingContactAccess.buyerId, listingContactAccess.listingId],
        set: {
          lastAccessedAt: new Date(),
          accessCount: sql`${listingContactAccess.accessCount} + 1`
        }
      });

    return {phoneNumber: target.phoneNumber, protocol: 'tel' as const};
  });
}
