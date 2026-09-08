import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getPublicReputation} from '@/modules/reputation/service';
import * as schema from '@/server/db/schema';

import {
  createReviewReport,
  decideReviewReport,
  listModerationReviewReports
} from './review-report-service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('review report persistence and permissions', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('accepts reports on public reviews and applies an independent audited decision', async () => {
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const firstReporterId = randomUUID();
    const secondReporterId = randomUUID();
    const moderatorId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const conversationId = randomUUID();
    const interactionId = randomUUID();
    const reviewId = randomUUID();
    const db = drizzle(client!, {schema});

    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Review subject', ${`${sellerId}@example.test`}, true),
          (${buyerId}, 'Review author', ${`${buyerId}@example.test`}, true),
          (${firstReporterId}, 'First reporter', ${`${firstReporterId}@example.test`}, true),
          (${secondReporterId}, 'Second reporter', ${`${secondReporterId}@example.test`}, true),
          (${moderatorId}, 'Independent reviewer', ${`${moderatorId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values
          (${sellerId}, 'moderator', ${moderatorId}),
          (${firstReporterId}, 'moderator', ${moderatorId}),
          (${moderatorId}, 'moderator', ${moderatorId})
      `;
      await client!`
        insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
        values (${draftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
      `;
      await client!`
        insert into listing (
          id, seller_id, source_draft_id, category_id, category_schema_version,
          location_id, public_location_precision, status, title, description, sold_at
        ) values (
          ${listingId}, ${sellerId}, ${draftId},
          '20000000-0000-4000-8000-000000000003', 1,
          '10000000-0000-4000-8000-000000000002', 'city', 'sold',
          'Review report integration listing',
          'A complete description for review report integration coverage.', now()
        )
      `;
      await client!`
        insert into conversation (id, listing_id, buyer_id, seller_id)
        values (${conversationId}, ${listingId}, ${buyerId}, ${sellerId})
      `;
      await client!`
        insert into qualified_interaction (
          id, listing_id, conversation_id, buyer_id, seller_id, qualified_by
        ) values (
          ${interactionId}, ${listingId}, ${conversationId}, ${buyerId}, ${sellerId}, ${sellerId}
        )
      `;
      await client!`
        insert into user_review (
          id, interaction_id, author_id, subject_id, rating, body, created_at, updated_at, reveal_at
        ) values (
          ${reviewId}, ${interactionId}, ${buyerId}, ${sellerId}, 2,
          'The review text contains information that needs moderation.',
          now() - interval '15 days', now() - interval '15 days', now() - interval '1 day'
        )
      `;

      await expect(
        createReviewReport(db, buyerId, reviewId, {reason: 'spam'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      const firstReport = await createReviewReport(db, firstReporterId, reviewId, {
        reason: 'personal_data',
        details: 'The review exposes personal contact information.'
      });
      expect(firstReport).toMatchObject({created: true, reviewId, status: 'open'});
      await expect(
        createReviewReport(db, firstReporterId, reviewId, {reason: 'spam'})
      ).resolves.toMatchObject({id: firstReport.id, created: false, reason: 'personal_data'});

      const secondReport = await createReviewReport(db, secondReporterId, reviewId, {
        reason: 'harassment'
      });

      await expect(
        listModerationReviewReports(db, sellerId, {locale: 'en', limit: 30})
      ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({reviewId})]));
      await expect(
        listModerationReviewReports(db, firstReporterId, {locale: 'en', limit: 30})
      ).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({reviewId})]));
      await expect(
        listModerationReviewReports(db, moderatorId, {locale: 'en', limit: 30})
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({reportId: firstReport.id, reviewId}),
          expect.objectContaining({reportId: secondReport.id, reviewId})
        ])
      );
      await expect(
        decideReviewReport(db, firstReporterId, secondReport.id, {action: 'hide_review'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      await expect(
        decideReviewReport(db, moderatorId, secondReport.id, {action: 'dismiss'})
      ).resolves.toMatchObject({reportStatus: 'dismissed', reviewStatus: 'active'});
      await expect(
        decideReviewReport(db, moderatorId, firstReport.id, {action: 'hide_review'})
      ).resolves.toMatchObject({reportStatus: 'resolved', reviewStatus: 'hidden'});
      await expect(
        decideReviewReport(db, moderatorId, firstReport.id, {action: 'dismiss'})
      ).rejects.toMatchObject({code: 'CONFLICT'});

      const profile = await getPublicReputation(db, sellerId, {limit: 20});
      expect(profile).toMatchObject({summary: {average: 0, count: 0}, reviews: []});

      const [audit] = await client!`
        select
          (select status from user_review where id = ${reviewId}) as review_status,
          (select count(*)::int from review_report where id in (${firstReport.id}, ${secondReport.id}) and status <> 'open') as resolved_reports,
          (select count(*)::int from review_report_action where report_id in (${firstReport.id}, ${secondReport.id})) as actions,
          (select count(*)::int from outbox_event where aggregate_id = ${reviewId} and event_type = 'reputation.review_hidden') as hidden_events
      `;
      expect(audit).toEqual({
        review_status: 'hidden',
        resolved_reports: 2,
        actions: 2,
        hidden_events: 1
      });
    } finally {
      await client!`
        delete from outbox_event
        where (aggregate_type = 'review_report' and payload->>'reviewId' = ${reviewId})
          or (aggregate_type = 'user_review' and aggregate_id = ${reviewId})
      `;
      await client!`
        delete from review_report_action
        where report_id in (select id from review_report where review_id = ${reviewId})
      `;
      await client!`delete from review_report where review_id = ${reviewId}`;
      await client!`delete from user_review where id = ${reviewId}`;
      await client!`delete from qualified_interaction where id = ${interactionId}`;
      await client!`delete from conversation where id = ${conversationId}`;
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`
        delete from user_role
        where user_id in (${sellerId}, ${firstReporterId}, ${moderatorId})
      `;
      await client!`
        delete from "user"
        where id in (${sellerId}, ${buyerId}, ${firstReporterId}, ${secondReporterId}, ${moderatorId})
      `;
    }
  });
});
