import {and, asc, desc, eq, gt, inArray, isNull, ne, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  categoryTranslation,
  listing,
  listingAppeal,
  listingAppealAction,
  listingStatusHistory,
  locationTranslation,
  moderationAction,
  moderationCase,
  moderationCaseSignal,
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

export type QueryExecutor = Pick<DatabaseClient, 'select'>;

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
      policyVersion: moderationCase.policyVersion,
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
    .where(
      and(
        eq(moderationCase.status, 'open'),
        eq(listing.status, 'pending_review'),
        ne(listing.sellerId, actorId)
      )
    )
    .orderBy(desc(moderationCase.priority), asc(moderationCase.openedAt), asc(moderationCase.id))
    .limit(query.limit);

  const signals = rows.length
    ? await db
        .select({
          caseId: moderationCaseSignal.caseId,
          code: moderationCaseSignal.code,
          weight: moderationCaseSignal.weight
        })
        .from(moderationCaseSignal)
        .where(
          inArray(
            moderationCaseSignal.caseId,
            rows.map((row) => row.caseId)
          )
        )
        .orderBy(desc(moderationCaseSignal.weight), asc(moderationCaseSignal.code))
    : [];
  const signalsByCase = new Map<
    string,
    Array<{code: (typeof signals)[number]['code']; weight: number}>
  >();
  for (const signal of signals) {
    const existing = signalsByCase.get(signal.caseId) ?? [];
    existing.push({code: signal.code, weight: signal.weight});
    signalsByCase.set(signal.caseId, existing);
  }

  return rows.map((row) => ({
    ...row,
    openedAt: row.openedAt.toISOString(),
    signals: signalsByCase.get(row.caseId) ?? []
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
      caseId: moderationCase.id
    })
    .from(listing)
    .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .where(and(eq(listing.id, listingId), eq(listing.sellerId, actorId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
  const [lastAction] = await db
    .select({
      id: moderationAction.id,
      reasonCode: moderationAction.reasonCode,
      publicExplanation: moderationAction.publicExplanation
    })
    .from(moderationAction)
    .where(eq(moderationAction.caseId, row.caseId))
    .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    .limit(1);
  const [appeal] = lastAction
    ? await db
        .select({
          id: listingAppeal.id,
          status: listingAppeal.status,
          statement: listingAppeal.statement,
          publicResponse: listingAppealAction.publicResponse
        })
        .from(listingAppeal)
        .leftJoin(listingAppealAction, eq(listingAppealAction.appealId, listingAppeal.id))
        .where(eq(listingAppeal.moderationActionId, lastAction.id))
        .limit(1)
    : [];
  return {
    listingId: row.listingId,
    status: row.status,
    caseStatus: row.caseStatus,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    reasonCode: lastAction?.reasonCode ?? null,
    publicExplanation: lastAction?.publicExplanation ?? null,
    appeal: appeal ?? null
  };
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
      locationName: locationTranslation.name
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
    .where(eq(listing.sellerId, actorId))
    .orderBy(desc(listing.updatedAt), desc(listing.id))
    .limit(query.limit);

  if (!rows.length) return [];
  const cases = await db
    .select({id: moderationCase.id, listingId: moderationCase.listingId})
    .from(moderationCase)
    .where(
      inArray(
        moderationCase.listingId,
        rows.map((row) => row.id)
      )
    );
  const caseListing = new Map(cases.map((item) => [item.id, item.listingId]));
  const actions = cases.length
    ? await db
        .select({
          id: moderationAction.id,
          caseId: moderationAction.caseId,
          reasonCode: moderationAction.reasonCode,
          publicExplanation: moderationAction.publicExplanation
        })
        .from(moderationAction)
        .where(
          inArray(
            moderationAction.caseId,
            cases.map((item) => item.id)
          )
        )
        .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    : [];
  const actionByListing = new Map<
    string,
    {id: string; reasonCode: string; publicExplanation: string | null}
  >();
  for (const action of actions) {
    const targetListingId = caseListing.get(action.caseId);
    if (targetListingId && !actionByListing.has(targetListingId))
      actionByListing.set(targetListingId, action);
  }
  const latestActionIds = [...actionByListing.values()].map((item) => item.id);
  const appeals = latestActionIds.length
    ? await db
        .select({
          id: listingAppeal.id,
          moderationActionId: listingAppeal.moderationActionId,
          status: listingAppeal.status,
          publicResponse: listingAppealAction.publicResponse
        })
        .from(listingAppeal)
        .leftJoin(listingAppealAction, eq(listingAppealAction.appealId, listingAppeal.id))
        .where(inArray(listingAppeal.moderationActionId, latestActionIds))
    : [];
  const appealByAction = new Map(appeals.map((item) => [item.moderationActionId, item]));

  return rows.map((row) => {
    const action = actionByListing.get(row.id);
    const appeal = action ? appealByAction.get(action.id) : undefined;
    return {
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      reasonCode: action?.reasonCode ?? null,
      publicExplanation: action?.publicExplanation ?? null,
      appealId: appeal?.id ?? null,
      appealStatus: appeal?.status ?? null,
      appealPublicResponse: appeal?.publicResponse ?? null
    };
  });
}

export async function requireModerationCapability(
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
