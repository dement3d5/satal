import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {publishListingDraft} from '@/modules/listings/publication-service';
import * as schema from '@/server/db/schema';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('listing submission moderation boundary', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('creates one pending listing and open case idempotently', async () => {
    const sellerId = randomUUID();
    const draftId = randomUUID();
    const db = drizzle(client!, {schema});
    let listingId: string | undefined;
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values (${sellerId}, 'Submission seller', ${`${sellerId}@example.test`}, true)
      `;
      await client!`
        insert into listing_draft (
          id, owner_id, category_id, category_schema_version, location_id,
          public_location_precision, title, description, status
        ) values (
          ${draftId}, ${sellerId}, '20000000-0000-4000-8000-000000000006', 1,
          '10000000-0000-4000-8000-000000000002', 'city',
          'Apartment submission test',
          'A complete apartment description for the moderation submission boundary.',
          'ready_for_review'
        )
      `;
      await client!`
        insert into listing_draft_attribute_value
          (draft_id, attribute_id, option_id, integer_value, decimal_value)
        values
          (${draftId}, '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', null, null),
          (${draftId}, '30000000-0000-4000-8000-000000000009', null, 2, null),
          (${draftId}, '30000000-0000-4000-8000-000000000010', null, null, 85)
      `;

      const created = await publishListingDraft(db, sellerId, draftId, {version: 1});
      listingId = created.id;
      expect(created).toMatchObject({status: 'pending_review', publishedAt: null});
      await expect(publishListingDraft(db, sellerId, draftId, {version: 1})).resolves.toEqual(
        created
      );

      const [persisted] = await client!`
        select l.status, l.published_at, mc.status as case_status, mc.policy_version
        from listing l
        join moderation_case mc on mc.listing_id = l.id
        where l.id = ${listingId}
      `;
      expect(persisted).toMatchObject({
        status: 'pending_review',
        published_at: null,
        case_status: 'open',
        policy_version: 'manual-review-v1'
      });
    } finally {
      if (listingId) {
        await client!`delete from outbox_event where aggregate_id = ${listingId}`;
        await client!`delete from moderation_case where listing_id = ${listingId}`;
        await client!`delete from listing_status_history where listing_id = ${listingId}`;
        await client!`delete from listing where id = ${listingId}`;
      }
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from "user" where id = ${sellerId}`;
    }
  });
});
