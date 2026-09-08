import {and, asc, count, eq, gte, inArray, ne, notExists} from 'drizzle-orm';
import {alias} from 'drizzle-orm/pg-core';

import {publicReviewVisibility} from '@/modules/reputation/visibility';
import type {DatabaseClient} from '@/server/db/client';
import {outboxEvent, reviewReport, reviewReportAction, user, userReview} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {CreateReviewReportInput, ReviewReportDecisionInput} from './review-report-contracts';
import {assertOpenReviewReport, assertReportableReview} from './review-report-domain';
import {requireModerationCapability} from './service';
import type {TrustQueueQuery} from './trust-contracts';

const REVIEW_REPORT_LIMIT_PER_HOUR = 10;

export async function createReviewReport(
  db: DatabaseClient,
  actorId: string,
  reviewId: string,
  input: CreateReviewReportInput
) {
  return db.transaction(async (transaction) => {
    const [actor] = await transaction
      .select({id: user.id})
      .from(user)
      .where(eq(user.id, actorId))
      .for('update')
      .limit(1);
    if (!actor) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);

    const [target] = await transaction
      .select({
        id: userReview.id,
        authorId: userReview.authorId,
        subjectId: userReview.subjectId,
        status: userReview.status,
        publiclyVisible: publicReviewVisibility()
      })
      .from(userReview)
      .where(eq(userReview.id, reviewId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Review was not found', 404);

    const [existing] = await transaction
      .select({
        id: reviewReport.id,
        reason: reviewReport.reason,
        status: reviewReport.status,
        createdAt: reviewReport.createdAt
      })
      .from(reviewReport)
      .where(and(eq(reviewReport.reporterId, actorId), eq(reviewReport.reviewId, reviewId)))
      .limit(1);
    if (existing) {
      return {
        ...existing,
        reviewId,
        created: false as const,
        createdAt: existing.createdAt.toISOString()
      };
    }

    assertReportableReview({
      actorId,
      authorId: target.authorId,
      reviewStatus: target.status,
      publiclyVisible: Boolean(target.publiclyVisible)
    });

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await transaction
      .select({value: count()})
      .from(reviewReport)
      .where(and(eq(reviewReport.reporterId, actorId), gte(reviewReport.createdAt, since)));
    if ((recent?.value ?? 0) >= REVIEW_REPORT_LIMIT_PER_HOUR) {
      throw new AppError('RATE_LIMITED', 'Review report limit reached', 429);
    }

    const [created] = await transaction
      .insert(reviewReport)
      .values({
        reviewId,
        reporterId: actorId,
        reason: input.reason,
        details: input.details
      })
      .returning({
        id: reviewReport.id,
        reason: reviewReport.reason,
        status: reviewReport.status,
        createdAt: reviewReport.createdAt
      });
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Review report was not created', 500);

    await transaction.insert(outboxEvent).values({
      aggregateType: 'review_report',
      aggregateId: created.id,
      eventType: 'reputation.review_reported',
      aggregateVersion: 1,
      payload: {reportId: created.id, reviewId, subjectId: target.subjectId}
    });

    return {
      ...created,
      reviewId,
      created: true as const,
      createdAt: created.createdAt.toISOString()
    };
  });
}

export async function listModerationReviewReports(
  db: DatabaseClient,
  actorId: string,
  query: TrustQueueQuery
) {
  await requireModerationCapability(db, actorId, 'review-reports:read');
  const author = alias(user, 'review_report_author');
  const subject = alias(user, 'review_report_subject');
  const ownReport = alias(reviewReport, 'review_report_own');
  const rows = await db
    .select({
      reportId: reviewReport.id,
      reviewId: userReview.id,
      rating: userReview.rating,
      reviewBody: userReview.body,
      authorName: author.name,
      subjectName: subject.name,
      reason: reviewReport.reason,
      details: reviewReport.details,
      createdAt: reviewReport.createdAt
    })
    .from(reviewReport)
    .innerJoin(userReview, eq(userReview.id, reviewReport.reviewId))
    .innerJoin(author, eq(author.id, userReview.authorId))
    .innerJoin(subject, eq(subject.id, userReview.subjectId))
    .where(
      and(
        eq(reviewReport.status, 'open'),
        eq(userReview.status, 'active'),
        ne(reviewReport.reporterId, actorId),
        ne(userReview.authorId, actorId),
        ne(userReview.subjectId, actorId),
        notExists(
          db
            .select({id: ownReport.id})
            .from(ownReport)
            .where(and(eq(ownReport.reviewId, userReview.id), eq(ownReport.reporterId, actorId)))
        )
      )
    )
    .orderBy(asc(reviewReport.createdAt), asc(reviewReport.id))
    .limit(query.limit);

  return rows.map((row) => ({...row, createdAt: row.createdAt.toISOString()}));
}

export async function decideReviewReport(
  db: DatabaseClient,
  actorId: string,
  reportId: string,
  input: ReviewReportDecisionInput
) {
  return db.transaction(async (transaction) => {
    await requireModerationCapability(transaction, actorId, 'review-reports:decide');
    const [reference] = await transaction
      .select({reviewId: reviewReport.reviewId})
      .from(reviewReport)
      .where(eq(reviewReport.id, reportId))
      .limit(1);
    if (!reference) throw new AppError('NOT_FOUND', 'Review report was not found', 404);

    const [review] = await transaction
      .select({
        id: userReview.id,
        status: userReview.status,
        authorId: userReview.authorId,
        subjectId: userReview.subjectId
      })
      .from(userReview)
      .where(eq(userReview.id, reference.reviewId))
      .for('update')
      .limit(1);
    if (!review) throw new AppError('NOT_FOUND', 'Review report was not found', 404);

    const [report] = await transaction
      .select({
        id: reviewReport.id,
        status: reviewReport.status,
        reporterId: reviewReport.reporterId
      })
      .from(reviewReport)
      .where(eq(reviewReport.id, reportId))
      .for('update')
      .limit(1);
    if (!report) throw new AppError('NOT_FOUND', 'Review report was not found', 404);
    const [reviewerReport] = await transaction
      .select({id: reviewReport.id})
      .from(reviewReport)
      .where(and(eq(reviewReport.reviewId, review.id), eq(reviewReport.reporterId, actorId)))
      .limit(1);

    assertOpenReviewReport({
      reportStatus: report.status,
      reviewStatus: review.status,
      reviewerId: actorId,
      reporterId: report.reporterId,
      authorId: review.authorId,
      subjectId: review.subjectId,
      reviewerReportedReview: Boolean(reviewerReport)
    });

    const now = new Date();
    if (input.action === 'dismiss') {
      await transaction
        .update(reviewReport)
        .set({status: 'dismissed', resolvedAt: now, updatedAt: now})
        .where(eq(reviewReport.id, reportId));
      await transaction.insert(reviewReportAction).values({
        reportId,
        actorId,
        action: 'dismiss',
        internalNote: input.internalNote
      });
      return {
        reportId,
        reviewId: review.id,
        reportStatus: 'dismissed' as const,
        reviewStatus: review.status
      };
    }

    const openReports = await transaction
      .select({id: reviewReport.id})
      .from(reviewReport)
      .where(and(eq(reviewReport.reviewId, review.id), eq(reviewReport.status, 'open')))
      .orderBy(reviewReport.id)
      .for('update');
    const reportIds = openReports.map((item) => item.id);
    const [hidden] = await transaction
      .update(userReview)
      .set({status: 'hidden', hiddenAt: now, updatedAt: now})
      .where(and(eq(userReview.id, review.id), eq(userReview.status, 'active')))
      .returning({id: userReview.id});
    if (!hidden) throw new AppError('CONFLICT', 'Review changed during moderation', 409);

    await transaction
      .update(reviewReport)
      .set({status: 'resolved', resolvedAt: now, updatedAt: now})
      .where(inArray(reviewReport.id, reportIds));
    await transaction.insert(reviewReportAction).values(
      reportIds.map((id) => ({
        reportId: id,
        actorId,
        action: 'hide_review' as const,
        internalNote: id === reportId ? input.internalNote : undefined
      }))
    );
    await transaction.insert(outboxEvent).values({
      aggregateType: 'user_review',
      aggregateId: review.id,
      eventType: 'reputation.review_hidden',
      aggregateVersion: 2,
      payload: {reviewId: review.id, reportId, subjectId: review.subjectId}
    });

    return {
      reportId,
      reviewId: review.id,
      reportStatus: 'resolved' as const,
      reviewStatus: 'hidden' as const
    };
  });
}
