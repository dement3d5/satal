import {and, asc, count, desc, eq, gte, inArray, ne, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  categoryTranslation,
  listing,
  listingAppeal,
  listingAppealAction,
  listingReport,
  listingReportAction,
  listingStatusHistory,
  locationTranslation,
  moderationAction,
  moderationCase,
  outboxEvent,
  user
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {requireModerationCapability} from './service';
import type {
  CreateListingAppealInput,
  CreateListingReportInput,
  ListingAppealDecisionInput,
  ListingReportDecisionInput,
  TrustQueueQuery
} from './trust-contracts';
import {
  assertAppealableListing,
  assertOpenAppeal,
  assertOpenReport,
  assertReportableListing
} from './trust-domain';

const REPORT_LIMIT_PER_HOUR = 10;

export async function getOwnListingReport(db: DatabaseClient, actorId: string, listingId: string) {
  const [row] = await db
    .select({
      id: listingReport.id,
      reason: listingReport.reason,
      status: listingReport.status,
      createdAt: listingReport.createdAt
    })
    .from(listingReport)
    .where(and(eq(listingReport.reporterId, actorId), eq(listingReport.listingId, listingId)))
    .limit(1);
  return row
    ? {...row, listingId, reported: true as const, createdAt: row.createdAt.toISOString()}
    : {listingId, reported: false as const};
}

export async function createListingReport(
  db: DatabaseClient,
  actorId: string,
  listingId: string,
  input: CreateListingReportInput
) {
  return db.transaction(async (transaction) => {
    await transaction.select({id: user.id}).from(user).where(eq(user.id, actorId)).for('update');
    const [target] = await transaction
      .select({sellerId: listing.sellerId, status: listing.status})
      .from(listing)
      .where(eq(listing.id, listingId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);

    const [existing] = await transaction
      .select({
        id: listingReport.id,
        reason: listingReport.reason,
        status: listingReport.status,
        createdAt: listingReport.createdAt
      })
      .from(listingReport)
      .where(and(eq(listingReport.reporterId, actorId), eq(listingReport.listingId, listingId)))
      .limit(1);
    if (existing)
      return {
        ...existing,
        listingId,
        created: false as const,
        createdAt: existing.createdAt.toISOString()
      };
    assertReportableListing({
      actorId,
      sellerId: target.sellerId,
      listingStatus: target.status
    });

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await transaction
      .select({value: count()})
      .from(listingReport)
      .where(and(eq(listingReport.reporterId, actorId), gte(listingReport.createdAt, since)));
    if ((recent?.value ?? 0) >= REPORT_LIMIT_PER_HOUR)
      throw new AppError('RATE_LIMITED', 'Listing report limit reached', 429);

    const [created] = await transaction
      .insert(listingReport)
      .values({
        listingId,
        reporterId: actorId,
        reason: input.reason,
        details: input.details
      })
      .returning({
        id: listingReport.id,
        reason: listingReport.reason,
        status: listingReport.status,
        createdAt: listingReport.createdAt
      });
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Listing report was not created', 500);
    await transaction.insert(outboxEvent).values({
      aggregateType: 'listing_report',
      aggregateId: created.id,
      eventType: 'listing.reported',
      aggregateVersion: 1,
      payload: {reportId: created.id, listingId}
    });
    return {
      ...created,
      listingId,
      created: true as const,
      createdAt: created.createdAt.toISOString()
    };
  });
}

export async function listModerationReports(
  db: DatabaseClient,
  actorId: string,
  query: TrustQueueQuery
) {
  await requireModerationCapability(db, actorId, 'reports:read');
  const rows = await db
    .select({
      reportId: listingReport.id,
      listingId: listing.id,
      reason: listingReport.reason,
      details: listingReport.details,
      createdAt: listingReport.createdAt,
      title: listing.title,
      sellerName: user.name,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name
    })
    .from(listingReport)
    .innerJoin(listing, eq(listing.id, listingReport.listingId))
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
        eq(listingReport.status, 'open'),
        eq(listing.status, 'active'),
        ne(listing.sellerId, actorId)
      )
    )
    .orderBy(asc(listingReport.createdAt), asc(listingReport.id))
    .limit(query.limit);
  return rows.map((row) => ({...row, createdAt: row.createdAt.toISOString()}));
}

export async function decideListingReport(
  db: DatabaseClient,
  actorId: string,
  reportId: string,
  input: ListingReportDecisionInput
) {
  return db.transaction(async (transaction) => {
    await requireModerationCapability(transaction, actorId, 'reports:decide');
    const [reportReference] = await transaction
      .select({
        id: listingReport.id,
        listingId: listingReport.listingId
      })
      .from(listingReport)
      .where(eq(listingReport.id, reportId))
      .limit(1);
    if (!reportReference) throw new AppError('NOT_FOUND', 'Listing report was not found', 404);
    const [target] = await transaction
      .select({sellerId: listing.sellerId, status: listing.status, version: listing.version})
      .from(listing)
      .where(eq(listing.id, reportReference.listingId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    const [report] = await transaction
      .select({
        id: listingReport.id,
        listingId: listingReport.listingId,
        status: listingReport.status
      })
      .from(listingReport)
      .where(eq(listingReport.id, reportId))
      .for('update')
      .limit(1);
    if (!report) throw new AppError('NOT_FOUND', 'Listing report was not found', 404);
    assertOpenReport({
      reportStatus: report.status,
      listingStatus: target.status,
      reviewerId: actorId,
      sellerId: target.sellerId
    });

    const now = new Date();
    if (input.action === 'dismiss') {
      await transaction
        .update(listingReport)
        .set({status: 'dismissed', resolvedAt: now, updatedAt: now})
        .where(eq(listingReport.id, reportId));
      await transaction.insert(listingReportAction).values({
        reportId,
        actorId,
        action: 'dismiss',
        internalNote: input.internalNote
      });
      return {reportId, listingId: report.listingId, reportStatus: 'dismissed' as const};
    }

    const openReports = await transaction
      .select({id: listingReport.id})
      .from(listingReport)
      .where(and(eq(listingReport.listingId, report.listingId), eq(listingReport.status, 'open')))
      .orderBy(listingReport.id)
      .for('update');
    const reportIds = openReports.map((item) => item.id);
    const [updatedListing] = await transaction
      .update(listing)
      .set({status: 'removed', version: sql`${listing.version} + 1`, updatedAt: now})
      .where(and(eq(listing.id, report.listingId), eq(listing.status, 'active')))
      .returning({version: listing.version});
    if (!updatedListing) throw new AppError('CONFLICT', 'Listing changed during review', 409);
    await transaction
      .update(listingReport)
      .set({status: 'resolved', resolvedAt: now, updatedAt: now})
      .where(inArray(listingReport.id, reportIds));
    await transaction.insert(listingReportAction).values(
      reportIds.map((id) => ({
        reportId: id,
        actorId,
        action: 'remove_listing' as const,
        internalNote: id === reportId ? input.internalNote : undefined
      }))
    );
    await transaction.insert(listingStatusHistory).values({
      listingId: report.listingId,
      actorId,
      fromStatus: 'active',
      toStatus: 'removed',
      reason: 'user_report_confirmed'
    });
    await transaction.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: report.listingId,
      eventType: 'listing.removed',
      aggregateVersion: updatedListing.version,
      payload: {listingId: report.listingId, reasonCode: 'user_report_confirmed'}
    });
    return {
      reportId,
      listingId: report.listingId,
      reportStatus: 'resolved' as const,
      listingStatus: 'removed' as const
    };
  });
}

export async function getOwnListingAppeal(db: DatabaseClient, actorId: string, listingId: string) {
  const target = await loadLatestRejection(db, actorId, listingId);
  if (!target) throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
  if (!target.actionId) return {listingId, appealable: false as const, appeal: null};
  const canAppeal =
    target.listingStatus === 'rejected' &&
    target.caseStatus === 'rejected' &&
    target.action === 'reject';
  const [appeal] = await db
    .select({
      id: listingAppeal.id,
      status: listingAppeal.status,
      statement: listingAppeal.statement,
      createdAt: listingAppeal.createdAt,
      resolvedAt: listingAppeal.resolvedAt,
      publicResponse: listingAppealAction.publicResponse
    })
    .from(listingAppeal)
    .leftJoin(listingAppealAction, eq(listingAppealAction.appealId, listingAppeal.id))
    .where(eq(listingAppeal.moderationActionId, target.actionId))
    .limit(1);
  return {
    listingId,
    appealable: canAppeal && !appeal,
    appeal: appeal
      ? {
          ...appeal,
          createdAt: appeal.createdAt.toISOString(),
          resolvedAt: appeal.resolvedAt?.toISOString() ?? null
        }
      : null
  };
}

export async function createListingAppeal(
  db: DatabaseClient,
  actorId: string,
  listingId: string,
  input: CreateListingAppealInput
) {
  return db.transaction(async (transaction) => {
    const target = await loadLatestRejection(transaction, actorId, listingId, true);
    if (!target) throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
    if (target.actionId) {
      const [existing] = await transaction
        .select({
          id: listingAppeal.id,
          status: listingAppeal.status,
          createdAt: listingAppeal.createdAt
        })
        .from(listingAppeal)
        .where(eq(listingAppeal.moderationActionId, target.actionId))
        .limit(1);
      if (existing)
        return {
          ...existing,
          listingId,
          created: false as const,
          createdAt: existing.createdAt.toISOString()
        };
    }
    assertAppealableListing({
      actorId,
      sellerId: target.sellerId,
      listingStatus: target.listingStatus,
      caseStatus: target.caseStatus,
      moderationAction: target.action
    });
    if (!target.actionId) throw new AppError('CONFLICT', 'This listing cannot be appealed', 409);

    const [created] = await transaction
      .insert(listingAppeal)
      .values({
        listingId,
        moderationActionId: target.actionId,
        appellantId: actorId,
        statement: input.statement
      })
      .returning({
        id: listingAppeal.id,
        status: listingAppeal.status,
        createdAt: listingAppeal.createdAt
      });
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Listing appeal was not created', 500);
    await transaction.insert(outboxEvent).values({
      aggregateType: 'listing_appeal',
      aggregateId: created.id,
      eventType: 'listing.appealed',
      aggregateVersion: 1,
      payload: {appealId: created.id, listingId}
    });
    return {
      ...created,
      listingId,
      created: true as const,
      createdAt: created.createdAt.toISOString()
    };
  });
}

export async function listModerationAppeals(
  db: DatabaseClient,
  actorId: string,
  query: TrustQueueQuery
) {
  await requireModerationCapability(db, actorId, 'appeals:read');
  const rows = await db
    .select({
      appealId: listingAppeal.id,
      listingId: listing.id,
      statement: listingAppeal.statement,
      createdAt: listingAppeal.createdAt,
      originalExplanation: moderationAction.publicExplanation,
      title: listing.title,
      sellerName: user.name,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name
    })
    .from(listingAppeal)
    .innerJoin(listing, eq(listing.id, listingAppeal.listingId))
    .innerJoin(user, eq(user.id, listing.sellerId))
    .innerJoin(moderationAction, eq(moderationAction.id, listingAppeal.moderationActionId))
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
        eq(listingAppeal.status, 'open'),
        eq(listing.status, 'rejected'),
        ne(listing.sellerId, actorId)
      )
    )
    .orderBy(asc(listingAppeal.createdAt), asc(listingAppeal.id))
    .limit(query.limit);
  return rows.map((row) => ({...row, createdAt: row.createdAt.toISOString()}));
}

export async function decideListingAppeal(
  db: DatabaseClient,
  actorId: string,
  appealId: string,
  input: ListingAppealDecisionInput
) {
  return db.transaction(async (transaction) => {
    await requireModerationCapability(transaction, actorId, 'appeals:decide');
    const [appealReference] = await transaction
      .select({listingId: listingAppeal.listingId})
      .from(listingAppeal)
      .where(eq(listingAppeal.id, appealId))
      .limit(1);
    if (!appealReference) throw new AppError('NOT_FOUND', 'Listing appeal was not found', 404);
    await transaction
      .select({id: moderationCase.id})
      .from(moderationCase)
      .where(eq(moderationCase.listingId, appealReference.listingId))
      .for('update');
    await transaction
      .select({id: listing.id})
      .from(listing)
      .where(eq(listing.id, appealReference.listingId))
      .for('update');
    const [target] = await transaction
      .select({
        listingId: listing.id,
        sellerId: listing.sellerId,
        listingStatus: listing.status,
        listingVersion: listing.version,
        caseId: moderationCase.id,
        caseStatus: moderationCase.status,
        appealStatus: listingAppeal.status
      })
      .from(listingAppeal)
      .innerJoin(listing, eq(listing.id, listingAppeal.listingId))
      .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
      .where(eq(listingAppeal.id, appealId))
      .for('update', {of: listingAppeal})
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing appeal was not found', 404);
    assertOpenAppeal({
      appealStatus: target.appealStatus,
      listingStatus: target.listingStatus,
      caseStatus: target.caseStatus,
      reviewerId: actorId,
      sellerId: target.sellerId
    });

    const now = new Date();
    const appealStatus = input.action === 'accept' ? 'accepted' : 'rejected';
    await transaction
      .update(listingAppeal)
      .set({status: appealStatus, resolvedAt: now, updatedAt: now})
      .where(eq(listingAppeal.id, appealId));
    await transaction.insert(listingAppealAction).values({
      appealId,
      actorId,
      action: input.action,
      publicResponse: input.publicResponse,
      internalNote: input.internalNote
    });

    if (input.action === 'reject') {
      await transaction.insert(outboxEvent).values({
        aggregateType: 'listing_appeal',
        aggregateId: appealId,
        eventType: 'listing.appeal_rejected',
        aggregateVersion: 1,
        payload: {appealId, listingId: target.listingId}
      });
      return {
        appealId,
        listingId: target.listingId,
        appealStatus,
        listingStatus: 'rejected' as const
      };
    }

    const [updatedListing] = await transaction
      .update(listing)
      .set({
        status: 'pending_review',
        version: sql`${listing.version} + 1`,
        publishedAt: null,
        expiresAt: null,
        updatedAt: now
      })
      .where(and(eq(listing.id, target.listingId), eq(listing.status, 'rejected')))
      .returning({version: listing.version});
    if (!updatedListing)
      throw new AppError('CONFLICT', 'Listing changed during appeal review', 409);
    await transaction
      .update(moderationCase)
      .set({
        status: 'open',
        priority: sql`greatest(${moderationCase.priority}, 500)`,
        riskBand: 'unassessed',
        assignedTo: null,
        openedAt: now,
        resolvedAt: null,
        updatedAt: now
      })
      .where(and(eq(moderationCase.id, target.caseId), eq(moderationCase.status, 'rejected')));
    await transaction.insert(listingStatusHistory).values({
      listingId: target.listingId,
      actorId,
      fromStatus: 'rejected',
      toStatus: 'pending_review',
      reason: 'appeal_accepted'
    });
    await transaction.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: target.listingId,
      eventType: 'listing.appeal_accepted',
      aggregateVersion: updatedListing.version,
      payload: {appealId, listingId: target.listingId}
    });
    return {
      appealId,
      listingId: target.listingId,
      appealStatus,
      listingStatus: 'pending_review' as const,
      version: updatedListing.version
    };
  });
}

type RejectionQuery = Pick<DatabaseClient, 'select'>;

async function loadLatestRejection(
  db: RejectionQuery,
  actorId: string,
  listingId: string,
  lock = false
) {
  if (lock) {
    await db
      .select({id: moderationCase.id})
      .from(moderationCase)
      .where(eq(moderationCase.listingId, listingId))
      .for('update');
    await db.select({id: listing.id}).from(listing).where(eq(listing.id, listingId)).for('update');
  }
  const listingQuery = db
    .select({
      sellerId: listing.sellerId,
      listingStatus: listing.status,
      caseId: moderationCase.id,
      caseStatus: moderationCase.status
    })
    .from(listing)
    .innerJoin(moderationCase, eq(moderationCase.listingId, listing.id))
    .where(and(eq(listing.id, listingId), eq(listing.sellerId, actorId)))
    .limit(1);
  const [target] = await listingQuery;
  if (!target) return null;
  const [action] = await db
    .select({id: moderationAction.id, action: moderationAction.action})
    .from(moderationAction)
    .where(and(eq(moderationAction.caseId, target.caseId), eq(moderationAction.action, 'reject')))
    .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
    .limit(1);
  return {
    ...target,
    actionId: action?.id ?? null,
    action: action?.action ?? null
  };
}
