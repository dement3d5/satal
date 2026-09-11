import {count, desc, eq, gte} from 'drizzle-orm';
import type {SQL} from 'drizzle-orm';
import type {PgTable} from 'drizzle-orm/pg-core';

import type {DatabaseClient} from '@/server/db/client';
import {
  listingAppeal,
  listingAppealAction,
  listingReport,
  listingReportAction,
  messageReport,
  messageReportAction,
  moderationAction,
  moderationCase,
  reviewReport,
  reviewReportAction,
  user
} from '@/server/db/schema';

import type {ModerationOperationsQuery} from './contracts';
import {requireModerationCapability} from './service';

type ModerationEntityType =
  'listing' | 'listing_report' | 'listing_appeal' | 'message_report' | 'review_report';

interface RecentModerationAction {
  id: string;
  entityType: ModerationEntityType;
  entityId: string;
  action: string;
  actorName: string;
  createdAt: Date;
}

export async function getModerationOperations(
  db: DatabaseClient,
  actorId: string,
  query: ModerationOperationsQuery
) {
  await requireModerationCapability(db, actorId, 'operations:read');
  const generatedAt = new Date();
  const since = new Date(generatedAt.getTime() - query.windowDays * 24 * 60 * 60 * 1000);

  const [
    openListings,
    openListingReports,
    openAppeals,
    openMessageReports,
    openReviewReports,
    listingDecisions,
    listingReportDecisions,
    appealDecisions,
    messageReportDecisions,
    reviewReportDecisions,
    listingActions,
    reportActions,
    appealActions,
    messageActions,
    reviewActions
  ] = await Promise.all([
    readCount(db, moderationCase, eq(moderationCase.status, 'open')),
    readCount(db, listingReport, eq(listingReport.status, 'open')),
    readCount(db, listingAppeal, eq(listingAppeal.status, 'open')),
    readCount(db, messageReport, eq(messageReport.status, 'open')),
    readCount(db, reviewReport, eq(reviewReport.status, 'open')),
    db
      .select({action: moderationAction.action, value: count()})
      .from(moderationAction)
      .where(gte(moderationAction.createdAt, since))
      .groupBy(moderationAction.action),
    db
      .select({action: listingReportAction.action, value: count()})
      .from(listingReportAction)
      .where(gte(listingReportAction.createdAt, since))
      .groupBy(listingReportAction.action),
    db
      .select({action: listingAppealAction.action, value: count()})
      .from(listingAppealAction)
      .where(gte(listingAppealAction.createdAt, since))
      .groupBy(listingAppealAction.action),
    db
      .select({action: messageReportAction.action, value: count()})
      .from(messageReportAction)
      .where(gte(messageReportAction.createdAt, since))
      .groupBy(messageReportAction.action),
    db
      .select({action: reviewReportAction.action, value: count()})
      .from(reviewReportAction)
      .where(gte(reviewReportAction.createdAt, since))
      .groupBy(reviewReportAction.action),
    db
      .select({
        id: moderationAction.id,
        entityId: moderationCase.listingId,
        action: moderationAction.action,
        actorName: user.name,
        createdAt: moderationAction.createdAt
      })
      .from(moderationAction)
      .innerJoin(moderationCase, eq(moderationCase.id, moderationAction.caseId))
      .innerJoin(user, eq(user.id, moderationAction.actorId))
      .orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
      .limit(query.limit),
    db
      .select({
        id: listingReportAction.id,
        entityId: listingReportAction.reportId,
        action: listingReportAction.action,
        actorName: user.name,
        createdAt: listingReportAction.createdAt
      })
      .from(listingReportAction)
      .innerJoin(user, eq(user.id, listingReportAction.actorId))
      .orderBy(desc(listingReportAction.createdAt), desc(listingReportAction.id))
      .limit(query.limit),
    db
      .select({
        id: listingAppealAction.id,
        entityId: listingAppealAction.appealId,
        action: listingAppealAction.action,
        actorName: user.name,
        createdAt: listingAppealAction.createdAt
      })
      .from(listingAppealAction)
      .innerJoin(user, eq(user.id, listingAppealAction.actorId))
      .orderBy(desc(listingAppealAction.createdAt), desc(listingAppealAction.id))
      .limit(query.limit),
    db
      .select({
        id: messageReportAction.id,
        entityId: messageReportAction.reportId,
        action: messageReportAction.action,
        actorName: user.name,
        createdAt: messageReportAction.createdAt
      })
      .from(messageReportAction)
      .innerJoin(user, eq(user.id, messageReportAction.actorId))
      .orderBy(desc(messageReportAction.createdAt), desc(messageReportAction.id))
      .limit(query.limit),
    db
      .select({
        id: reviewReportAction.id,
        entityId: reviewReportAction.reportId,
        action: reviewReportAction.action,
        actorName: user.name,
        createdAt: reviewReportAction.createdAt
      })
      .from(reviewReportAction)
      .innerJoin(user, eq(user.id, reviewReportAction.actorId))
      .orderBy(desc(reviewReportAction.createdAt), desc(reviewReportAction.id))
      .limit(query.limit)
  ]);

  const recentActions: RecentModerationAction[] = [
    ...withEntityType(listingActions, 'listing'),
    ...withEntityType(reportActions, 'listing_report'),
    ...withEntityType(appealActions, 'listing_appeal'),
    ...withEntityType(messageActions, 'message_report'),
    ...withEntityType(reviewActions, 'review_report')
  ];
  recentActions.sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
  );

  return {
    generatedAt: generatedAt.toISOString(),
    windowDays: query.windowDays,
    queueCounts: {
      listings: openListings,
      listingReports: openListingReports,
      appeals: openAppeals,
      messageReports: openMessageReports,
      reviewReports: openReviewReports
    },
    decisionCounts: {
      listingsApproved: actionCount(listingDecisions, 'approve'),
      listingsRejected: actionCount(listingDecisions, 'reject'),
      listingReportsDismissed: actionCount(listingReportDecisions, 'dismiss'),
      listingsRemoved: actionCount(listingReportDecisions, 'remove_listing'),
      appealsAccepted: actionCount(appealDecisions, 'accept'),
      appealsRejected: actionCount(appealDecisions, 'reject'),
      messageReportsDismissed: actionCount(messageReportDecisions, 'dismiss'),
      conversationsClosed: actionCount(messageReportDecisions, 'close_conversation'),
      reviewReportsDismissed: actionCount(reviewReportDecisions, 'dismiss'),
      reviewsHidden: actionCount(reviewReportDecisions, 'hide_review')
    },
    recentActions: recentActions.slice(0, query.limit).map((action) => ({
      ...action,
      createdAt: action.createdAt.toISOString()
    }))
  };
}

function withEntityType<T extends Omit<RecentModerationAction, 'entityType'>>(
  rows: T[],
  entityType: ModerationEntityType
): RecentModerationAction[] {
  return rows.map((row) => ({...row, entityType}));
}

function actionCount<TAction extends string>(
  rows: Array<{action: TAction; value: number}>,
  action: TAction
): number {
  return rows.find((row) => row.action === action)?.value ?? 0;
}

async function readCount(db: DatabaseClient, table: PgTable, condition: SQL): Promise<number> {
  const [row] = await db.select({value: count()}).from(table).where(condition);
  return row?.value ?? 0;
}
