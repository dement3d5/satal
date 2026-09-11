import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {getModerationOperations} from './operations-service';
import {decideModerationCase} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('moderation operations permissions and audit projection', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('limits operations to owner/admin and returns a privacy-safe recent decision', async () => {
    const sellerId = randomUUID();
    const ownerId = randomUUID();
    const moderatorId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const caseId = randomUUID();
    const db = drizzle(client!, {schema});
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Operations seller', ${`${sellerId}@example.test`}, true),
          (${ownerId}, 'Operations owner', ${`${ownerId}@example.test`}, true),
          (${moderatorId}, 'Operations moderator', ${`${moderatorId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values
          (${ownerId}, 'owner', ${ownerId}),
          (${moderatorId}, 'moderator', ${ownerId})
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
          'Operations audit integration listing',
          'A complete description for the moderation operations integration coverage.'
        )
      `;
      await client!`
        insert into moderation_case (id, listing_id, policy_version, risk_band)
        values (${caseId}, ${listingId}, 'listing-risk-v1', 'low')
      `;

      await expect(
        getModerationOperations(db, moderatorId, {windowDays: 7, limit: 50})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      await decideModerationCase(db, ownerId, caseId, {
        action: 'approve',
        reasonCode: 'policy_compliant'
      });
      const operations = await getModerationOperations(db, ownerId, {
        windowDays: 7,
        limit: 50
      });

      expect(operations.decisionCounts.listingsApproved).toBeGreaterThanOrEqual(1);
      expect(operations.recentActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityType: 'listing',
            entityId: listingId,
            action: 'approve',
            actorName: 'Operations owner'
          })
        ])
      );
      expect(JSON.stringify(operations)).not.toContain('internalNote');
      expect(JSON.stringify(operations)).not.toContain(sellerId);
    } finally {
      await client!`delete from outbox_event where aggregate_id = ${listingId}`;
      await client!`delete from moderation_action where case_id = ${caseId}`;
      await client!`delete from moderation_case where id = ${caseId}`;
      await client!`delete from listing_status_history where listing_id = ${listingId}`;
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from user_role where user_id in (${ownerId}, ${moderatorId})`;
      await client!`delete from "user" where id in (${sellerId}, ${ownerId}, ${moderatorId})`;
    }
  });
});
