import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {
  decideModerationCase,
  getOwnListingReview,
  listModerationQueue,
  listOwnListings
} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('moderation persistence and permissions', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps the queue staff-only and records an atomic approval', async () => {
    const sellerId = randomUUID();
    const reviewerId = randomUUID();
    const ordinaryId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const caseId = randomUUID();
    const db = drizzle(client!, {schema});
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Moderation seller', ${`${sellerId}@example.test`}, true),
          (${reviewerId}, 'Moderation reviewer', ${`${reviewerId}@example.test`}, true),
          (${ordinaryId}, 'Ordinary user', ${`${ordinaryId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values (${reviewerId}, 'moderator', ${reviewerId}), (${sellerId}, 'moderator', ${reviewerId})
      `;
      await client!`
        insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
        values (${draftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
      `;
      await client!`
        insert into listing (
          id, seller_id, source_draft_id, category_id, category_schema_version,
          location_id, public_location_precision, status, title, description
        ) values (
          ${listingId}, ${sellerId}, ${draftId},
          '20000000-0000-4000-8000-000000000003', 1,
          '10000000-0000-4000-8000-000000000002', 'city', 'pending_review',
          'Moderation integration listing',
          'A complete description for moderation integration coverage.'
        )
      `;
      await client!`
        insert into moderation_case (id, listing_id, policy_version)
        values (${caseId}, ${listingId}, 'manual-review-v1')
      `;

      await expect(
        listModerationQueue(db, ordinaryId, {locale: 'en', limit: 30})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        decideModerationCase(db, sellerId, caseId, {
          action: 'approve',
          reasonCode: 'policy_compliant'
        })
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(listModerationQueue(db, reviewerId, {locale: 'en', limit: 30})).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({caseId, listingId})])
      );

      await expect(
        decideModerationCase(db, reviewerId, caseId, {
          action: 'approve',
          reasonCode: 'policy_compliant'
        })
      ).resolves.toMatchObject({caseId, listingId, status: 'active', version: 2});
      await expect(
        decideModerationCase(db, reviewerId, caseId, {
          action: 'approve',
          reasonCode: 'policy_compliant'
        })
      ).rejects.toMatchObject({code: 'CONFLICT'});
      await expect(getOwnListingReview(db, sellerId, listingId)).resolves.toMatchObject({
        listingId,
        status: 'active',
        caseStatus: 'approved'
      });
      await expect(listOwnListings(db, sellerId, {locale: 'en', limit: 30})).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({id: listingId, status: 'active'})])
      );

      const [audit] = await client!`
        select l.status, l.published_at, mc.status as case_status, ma.action, ma.reason_code
        from listing l
        join moderation_case mc on mc.listing_id = l.id
        join moderation_action ma on ma.case_id = mc.id
        where l.id = ${listingId}
      `;
      expect(audit).toMatchObject({
        status: 'active',
        case_status: 'approved',
        action: 'approve',
        reason_code: 'policy_compliant'
      });
      expect(Number.isNaN(Date.parse(String(audit?.published_at)))).toBe(false);
    } finally {
      await client!`delete from outbox_event where aggregate_id = ${listingId}`;
      await client!`delete from moderation_action where case_id = ${caseId}`;
      await client!`delete from moderation_case where id = ${caseId}`;
      await client!`delete from listing_status_history where listing_id = ${listingId}`;
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from user_role where user_id in (${sellerId}, ${reviewerId})`;
      await client!`delete from "user" where id in (${sellerId}, ${reviewerId}, ${ordinaryId})`;
    }
  });
});
