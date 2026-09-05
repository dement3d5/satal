import {and, asc, desc, eq, gt, inArray, isNull, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  categoryTranslation,
  listing,
  listingStatusHistory,
  locationTranslation,
  moderationAction,
  moderationCase,
  outboxEvent,
  user,
  userRole
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {ModerationDecisionInput, ModerationQueueQuery} from './contracts';
import {
  assertModerationCapability,
  assertReviewableCase,
  type ModerationCapability,
  type StaffRole
} from './domain';

type QueryExecutor = Pick<DatabaseClient, 'select'>;

export async function listModerationQueue(
  db: DatabaseClient,
  actorId: string,
  query: ModerationQueueQuery
) {
  await requireModerationCapability(db, actorId, 'queue:read');
  const rows = await db
    .select({
      caseId: moderationCase.id,
      listingId: listing.id,
      priority: moderationCase.priority,
      riskBand: moderationCase.riskBand,
      openedAt: moderationCase.openedAt,
      title: listing.title,
      description: listing.description,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      sellerName: user.name,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name
    })
    .from(moderationCase)
    .innerJoin(listing, eq(listing.id, moderationCase.listingId))
    .innerJoin(user, eq(user.id, listing.sellerId))
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, query.locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, query.locale)
      )
    )
    .where(and(eq(moderationCase.status, 'open'), eq(listing.status, 'pending_review')))
    .orderBy(desc(moderationCase.priority), asc(moderationCase.openedAt), asc(moderationCase.id))
    .limit(query.limit);

  return rows.map((row) => ({
    ...row,
    openedAt: row.openedAt.toISOString()
  }));
}

export async function decideModerationCase(
  db: DatabaseClient,
  actorId: string,
  caseId: string,
  input: ModerationDecisionInput
) {
  return db.transaction(async (tx) => {
    await requireModerationCapability(tx, actorId, 'decision:write');
    const [reviewCase] = await tx
      .select({
        id: moderationCase.id,
        status: moderationCase.status,
        listingId: moderationCase.listingId
      })
      .from(moderationCase)
      .where(eq(moderationCase.id, caseId))
      .for('update')
      .limit(1);
    if (!reviewCase) throw new AppError('NOT_FOUND', 'Moderation case was not found', 404);

    const [target] = await tx
      .select({status: listing.status, sellerId: listing.sellerId, version: listing.version})
      .from(listing)
      .where(eq(listing.id, reviewCase.listingId))
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    assertReviewableCase({
      caseStatus: reviewCase.status,
      listingStatus: target.status,
      reviewerId: actorId,
      sellerId: target.sellerId
    });

    const now = new Date();
    const nextStatus = input.action === 'approve' ? 'active' : 'rejected';
    const expiresAt = input.action === 'approve' ? new Date(now) : null;
    expiresAt?.setUTCDate(expiresAt.getUTCDate() + 45);
    const [updated] = await tx
      .update(listing)
      .set({
        status: nextStatus,
        version: sql`${listing.version} + 1`,
        publishedAt: input.action === 'approve' ? now : null,
        expiresAt,
        updatedAt: now
      })
      .where(and(eq(listing.id, reviewCase.listingId), eq(listing.status, 'pending_review')))
      .returning({id: listing.id, version: listing.version, status: listing.status});
    if (!updated) throw new AppError('CONFLICT', 'Listing changed during moderation', 409);

    await tx
      .update(moderationCase)
      .set({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        assignedTo: actorId,
        resolvedAt: now,
        updatedAt: now
      })
      .where(eq(moderationCase.id, caseId));
    await tx.insert(moderationAction).values({
      caseId,
      actorId,
      action: input.action,
      reasonCode: input.reasonCode,
      publicExplanation: input.action === 'reject' ? input.publicExplanation : null,
      internalNote: input.internalNote
    });
    await tx.insert(listingStatusHistory).values({
      listingId: reviewCase.listingId,
      actorId,
      fromStatus: 'pending_review',
      toStatus: nextStatus,
      reason: input.reasonCode
    });
    await tx.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: reviewCase.listingId,
      eventType: input.action === 'approve' ? 'listing.published' : 'listing.rejected',
      aggregateVersion: updated.version,
      payload: {listingId: reviewCase.listingId, reasonCode: input.reasonCode}
    });

    return {
      caseId,
      listingId: reviewCase.listingId,
      status: updated.status,
      version: updated.version
    };
  });
}

export async function getOwnListingReview(db: DatabaseClient, actorId: string, listingId: string) {
  const [row] = await db
    .select({
      listingId: listing.id,
      status: listing.status,
      caseStatus: moderationCase.status,
      resolvedAt: moderationCase.resolvedAt,
      reasonCode: moderationAction.reasonCode,
      publicExplanation: moderationAction.publicExplanation
    })
    .from(listing)
    .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .leftJoin(moderationAction, eq(moderationAction.caseId, moderationCase.id))
    .where(and(eq(listing.id, listingId), eq(listing.sellerId, actorId)))
    .orderBy(desc(moderationAction.createdAt))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
  return {...row, resolvedAt: row.resolvedAt?.toISOString() ?? null};
}

export async function listOwnListings(
  db: DatabaseClient,
  actorId: string,
  query: ModerationQueueQuery
) {
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      updatedAt: listing.updatedAt,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name,
      reasonCode: moderationAction.reasonCode,
      publicExplanation: moderationAction.publicExplanation
    })
    .from(listing)
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, query.locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, query.locale)
      )
    )
    .leftJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .leftJoin(moderationAction, eq(moderationAction.caseId, moderationCase.id))
    .where(eq(listing.sellerId, actorId))
    .orderBy(desc(listing.updatedAt), desc(listing.id))
    .limit(query.limit);

  return rows.map((row) => ({...row, updatedAt: row.updatedAt.toISOString()}));
}

async function requireModerationCapability(
  db: QueryExecutor,
  actorId: string,
  capability: ModerationCapability
): Promise<void> {
  const now = new Date();
  const rows = await db
    .select({role: userRole.role})
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, actorId),
        inArray(userRole.role, ['moderator', 'admin', 'owner']),
        or(isNull(userRole.expiresAt), gt(userRole.expiresAt, now))
      )
    );
  assertModerationCapability(
    rows.map((row) => row.role as StaffRole),
    capability
  );
}
