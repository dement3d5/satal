import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {decideModerationCase, getOwnListingReview, listOwnListings} from './service';
import {
  createListingAppeal,
  createListingReport,
  decideListingAppeal,
  decideListingReport,
  getOwnListingAppeal,
  getOwnListingReport,
  listModerationAppeals,
  listModerationReports
} from './trust-service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('reports and appeals persistence and permissions', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps reports idempotent and staff-only, and audits dismissals and removals', async () => {
    const sellerId = randomUUID();
    const reporterId = randomUUID();
    const secondReporterId = randomUUID();
    const reviewerId = randomUUID();
    const firstDraftId = randomUUID();
    const secondDraftId = randomUUID();
    const firstListingId = randomUUID();
    const secondListingId = randomUUID();
    const firstCaseId = randomUUID();
    const secondCaseId = randomUUID();
    const db = drizzle(client!, {schema});
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Report seller', ${`${sellerId}@example.test`}, true),
          (${reporterId}, 'First reporter', ${`${reporterId}@example.test`}, true),
          (${secondReporterId}, 'Second reporter', ${`${secondReporterId}@example.test`}, true),
          (${reviewerId}, 'Report reviewer', ${`${reviewerId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values (${reviewerId}, 'moderator', ${reviewerId}), (${sellerId}, 'moderator', ${reviewerId})
      `;
      await client!`
        insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
        values
          (${firstDraftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted'),
          (${secondDraftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
      `;
      await client!`
        insert into listing (
          id, seller_id, source_draft_id, category_id, category_schema_version,
          location_id, public_location_precision, status, title, description, published_at
        ) values
          (
            ${firstListingId}, ${sellerId}, ${firstDraftId},
            '20000000-0000-4000-8000-000000000003', 1,
            '10000000-0000-4000-8000-000000000002', 'city', 'active',
            'Reported active listing one',
            'A complete description for report removal integration coverage.', now()
          ),
          (
            ${secondListingId}, ${sellerId}, ${secondDraftId},
            '20000000-0000-4000-8000-000000000003', 1,
            '10000000-0000-4000-8000-000000000002', 'city', 'active',
            'Reported active listing two',
            'A complete description for report dismissal integration coverage.', now()
          )
      `;
      await client!`
        insert into moderation_case (id, listing_id, status, policy_version, resolved_at)
        values
          (${firstCaseId}, ${firstListingId}, 'approved', 'manual-review-v1', now()),
          (${secondCaseId}, ${secondListingId}, 'approved', 'manual-review-v1', now())
      `;
      await client!`
        insert into moderation_action (case_id, actor_id, action, reason_code)
        values
          (${firstCaseId}, ${reviewerId}, 'approve', 'policy_compliant'),
          (${secondCaseId}, ${reviewerId}, 'approve', 'policy_compliant')
      `;

      await expect(
        createListingReport(db, sellerId, firstListingId, {reason: 'fraud'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      const first = await createListingReport(db, reporterId, firstListingId, {
        reason: 'fraud',
        details: 'The seller requests an unsafe advance payment.'
      });
      await expect(
        createListingReport(db, reporterId, firstListingId, {reason: 'duplicate'})
      ).resolves.toMatchObject({id: first.id, created: false});
      const second = await createListingReport(db, secondReporterId, firstListingId, {
        reason: 'misleading_price'
      });
      await expect(getOwnListingReport(db, reporterId, firstListingId)).resolves.toMatchObject({
        reported: true,
        id: first.id
      });
      await expect(
        listModerationReports(db, reporterId, {locale: 'en', limit: 30})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        listModerationReports(db, sellerId, {locale: 'en', limit: 30})
      ).resolves.not.toEqual(
        expect.arrayContaining([expect.objectContaining({reportId: first.id})])
      );
      await expect(
        listModerationReports(db, reviewerId, {locale: 'en', limit: 30})
      ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({reportId: first.id})]));
      await expect(
        decideListingReport(db, sellerId, first.id, {action: 'remove_listing'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        decideListingReport(db, reviewerId, first.id, {action: 'remove_listing'})
      ).resolves.toMatchObject({listingStatus: 'removed', reportStatus: 'resolved'});
      await expect(
        createListingReport(db, reporterId, firstListingId, {reason: 'fraud'})
      ).resolves.toMatchObject({id: first.id, created: false, status: 'resolved'});
      await expect(
        decideListingReport(db, reviewerId, first.id, {action: 'dismiss'})
      ).rejects.toMatchObject({code: 'CONFLICT'});

      const dismissed = await createListingReport(db, reporterId, secondListingId, {
        reason: 'stale_listing'
      });
      await expect(
        decideListingReport(db, reviewerId, dismissed.id, {action: 'dismiss'})
      ).resolves.toMatchObject({reportStatus: 'dismissed'});

      const audit = await client!`
        select
          (select status from listing where id = ${firstListingId}) as listing_status,
          (select count(*)::int from listing_report where listing_id = ${firstListingId} and status = 'resolved') as resolved_reports,
          (select count(*)::int from listing_report_action where report_id in (${first.id}, ${second.id}) and action = 'remove_listing') as removal_actions,
          (select count(*)::int from listing_report_action where report_id = ${dismissed.id} and action = 'dismiss') as dismissal_actions
      `;
      expect(audit[0]).toMatchObject({
        listing_status: 'removed',
        resolved_reports: 2,
        removal_actions: 2,
        dismissal_actions: 1
      });
    } finally {
      await client!`delete from outbox_event where aggregate_type = 'listing_report' and aggregate_id in (select id from listing_report where listing_id in (${firstListingId}, ${secondListingId}))`;
      await client!`delete from outbox_event where aggregate_id in (${firstListingId}, ${secondListingId})`;
      await client!`delete from listing_report_action where report_id in (select id from listing_report where listing_id in (${firstListingId}, ${secondListingId}))`;
      await client!`delete from listing_report where listing_id in (${firstListingId}, ${secondListingId})`;
      await client!`delete from moderation_action where case_id in (${firstCaseId}, ${secondCaseId})`;
      await client!`delete from moderation_case where id in (${firstCaseId}, ${secondCaseId})`;
      await client!`delete from listing_status_history where listing_id in (${firstListingId}, ${secondListingId})`;
      await client!`delete from listing where id in (${firstListingId}, ${secondListingId})`;
      await client!`delete from listing_draft where id in (${firstDraftId}, ${secondDraftId})`;
      await client!`delete from user_role where user_id in (${sellerId}, ${reviewerId})`;
      await client!`delete from "user" where id in (${sellerId}, ${reporterId}, ${secondReporterId}, ${reviewerId})`;
    }
  });

  it('allows one appeal per rejection and safely reopens accepted listings', async () => {
    const sellerId = randomUUID();
    const reviewerId = randomUUID();
    const ordinaryId = randomUUID();
    const acceptedDraftId = randomUUID();
    const rejectedDraftId = randomUUID();
    const acceptedListingId = randomUUID();
    const rejectedListingId = randomUUID();
    const acceptedCaseId = randomUUID();
    const rejectedCaseId = randomUUID();
    const acceptedActionId = randomUUID();
    const rejectedActionId = randomUUID();
    const db = drizzle(client!, {schema});
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Appeal seller', ${`${sellerId}@example.test`}, true),
          (${reviewerId}, 'Appeal reviewer', ${`${reviewerId}@example.test`}, true),
          (${ordinaryId}, 'Appeal ordinary', ${`${ordinaryId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values (${reviewerId}, 'moderator', ${reviewerId}), (${sellerId}, 'moderator', ${reviewerId})
      `;
      await client!`
        insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
        values
          (${acceptedDraftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted'),
          (${rejectedDraftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
      `;
      await client!`
        insert into listing (
          id, seller_id, source_draft_id, category_id, category_schema_version,
          location_id, public_location_precision, status, title, description
        ) values
          (
            ${acceptedListingId}, ${sellerId}, ${acceptedDraftId},
            '20000000-0000-4000-8000-000000000003', 1,
            '10000000-0000-4000-8000-000000000002', 'city', 'rejected',
            'Appeal accepted integration listing',
            'A complete description for accepted appeal integration coverage.'
          ),
          (
            ${rejectedListingId}, ${sellerId}, ${rejectedDraftId},
            '20000000-0000-4000-8000-000000000003', 1,
            '10000000-0000-4000-8000-000000000002', 'city', 'rejected',
            'Appeal rejected integration listing',
            'A complete description for rejected appeal integration coverage.'
          )
      `;
      await client!`
        insert into moderation_case (id, listing_id, status, policy_version, resolved_at)
        values
          (${acceptedCaseId}, ${acceptedListingId}, 'rejected', 'manual-review-v1', now()),
          (${rejectedCaseId}, ${rejectedListingId}, 'rejected', 'manual-review-v1', now())
      `;
      await client!`
        insert into moderation_action (
          id, case_id, actor_id, action, reason_code, public_explanation
        ) values
          (
            ${acceptedActionId}, ${acceptedCaseId}, ${reviewerId}, 'reject',
            'insufficient_information', 'Please add enough verifiable information.'
          ),
          (
            ${rejectedActionId}, ${rejectedCaseId}, ${reviewerId}, 'reject',
            'wrong_category', 'Please use the category that matches this item.'
          )
      `;

      await expect(
        createListingAppeal(db, ordinaryId, acceptedListingId, {
          statement: 'I would like the listing to be reviewed again.'
        })
      ).rejects.toMatchObject({code: 'NOT_FOUND'});
      await expect(getOwnListingAppeal(db, sellerId, acceptedListingId)).resolves.toMatchObject({
        appealable: true,
        appeal: null
      });
      const acceptedAppeal = await createListingAppeal(db, sellerId, acceptedListingId, {
        statement: 'The requested information was already included in the full description.'
      });
      await expect(
        createListingAppeal(db, sellerId, acceptedListingId, {
          statement: 'This repeated submission should return the same appeal record.'
        })
      ).resolves.toMatchObject({id: acceptedAppeal.id, created: false});
      await expect(
        listModerationAppeals(db, ordinaryId, {locale: 'en', limit: 30})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        listModerationAppeals(db, sellerId, {locale: 'en', limit: 30})
      ).resolves.not.toEqual(
        expect.arrayContaining([expect.objectContaining({appealId: acceptedAppeal.id})])
      );
      await expect(
        listModerationAppeals(db, reviewerId, {locale: 'en', limit: 30})
      ).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({appealId: acceptedAppeal.id})])
      );
      await expect(
        decideListingAppeal(db, sellerId, acceptedAppeal.id, {action: 'accept'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        decideListingAppeal(db, reviewerId, acceptedAppeal.id, {action: 'accept'})
      ).resolves.toMatchObject({appealStatus: 'accepted', listingStatus: 'pending_review'});
      await expect(getOwnListingReview(db, sellerId, acceptedListingId)).resolves.toMatchObject({
        status: 'pending_review',
        caseStatus: 'open',
        appeal: {id: acceptedAppeal.id, status: 'accepted'}
      });
      await expect(
        decideModerationCase(db, reviewerId, acceptedCaseId, {
          action: 'approve',
          reasonCode: 'policy_compliant'
        })
      ).resolves.toMatchObject({status: 'active'});
      await expect(
        createListingAppeal(db, sellerId, acceptedListingId, {
          statement: 'A delayed retry must return the original appeal record.'
        })
      ).resolves.toMatchObject({id: acceptedAppeal.id, created: false, status: 'accepted'});

      const rejectedAppeal = await createListingAppeal(db, sellerId, rejectedListingId, {
        statement: 'Please review the selected category and the supplied description again.'
      });
      await expect(
        decideListingAppeal(db, reviewerId, rejectedAppeal.id, {
          action: 'reject',
          publicResponse: 'The selected category still does not match the advertised item.'
        })
      ).resolves.toMatchObject({appealStatus: 'rejected', listingStatus: 'rejected'});
      await expect(getOwnListingAppeal(db, sellerId, rejectedListingId)).resolves.toMatchObject({
        appealable: false,
        appeal: {
          id: rejectedAppeal.id,
          status: 'rejected',
          publicResponse: 'The selected category still does not match the advertised item.'
        }
      });
      await expect(listOwnListings(db, sellerId, {locale: 'en', limit: 30})).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: rejectedListingId,
            appealStatus: 'rejected',
            appealId: rejectedAppeal.id
          })
        ])
      );
    } finally {
      await client!`delete from outbox_event where aggregate_type = 'listing_appeal' and aggregate_id in (select id from listing_appeal where listing_id in (${acceptedListingId}, ${rejectedListingId}))`;
      await client!`delete from outbox_event where aggregate_id in (${acceptedListingId}, ${rejectedListingId})`;
      await client!`delete from listing_appeal_action where appeal_id in (select id from listing_appeal where listing_id in (${acceptedListingId}, ${rejectedListingId}))`;
      await client!`delete from listing_appeal where listing_id in (${acceptedListingId}, ${rejectedListingId})`;
      await client!`delete from moderation_action where case_id in (${acceptedCaseId}, ${rejectedCaseId})`;
      await client!`delete from moderation_case where id in (${acceptedCaseId}, ${rejectedCaseId})`;
      await client!`delete from listing_status_history where listing_id in (${acceptedListingId}, ${rejectedListingId})`;
      await client!`delete from listing where id in (${acceptedListingId}, ${rejectedListingId})`;
      await client!`delete from listing_draft where id in (${acceptedDraftId}, ${rejectedDraftId})`;
      await client!`delete from user_role where user_id in (${sellerId}, ${reviewerId})`;
      await client!`delete from "user" where id in (${sellerId}, ${reviewerId}, ${ordinaryId})`;
    }
  });
});
