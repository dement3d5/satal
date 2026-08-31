import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {searchPostgres} from './postgres-search';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('PostgreSQL degraded search', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('finds active text within ancestor category/location scopes and respects price', async () => {
    const ownerId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified)
      values (${ownerId}, 'Search owner', ${`${ownerId}@example.test`}, true)
    `;
    await client!`
      insert into listing_draft (id, owner_id, category_id, category_schema_version)
      values (${draftId}, ${ownerId}, '20000000-0000-4000-8000-000000000003', 1)
    `;
    await client!`
      insert into listing
        (id, seller_id, source_draft_id, category_id, category_schema_version, location_id,
         public_location_precision, status, title, description, price_minor, published_at)
      values (
        ${listingId}, ${ownerId}, ${draftId}, '20000000-0000-4000-8000-000000000003', 1,
        '10000000-0000-4000-8000-000000000002', 'city', 'active',
        'Unique Camry integration', 'Searchable marketplace vehicle.', 2500000, now()
      )
    `;

    const result = await searchPostgres(drizzle(client!, {schema}), {
      q: 'Camry',
      categoryId: '20000000-0000-4000-8000-000000000001',
      locationId: '10000000-0000-4000-8000-000000000001',
      priceMinMinor: 2_000_000,
      priceMaxMinor: 3_000_000,
      sort: 'relevance',
      page: 1,
      limit: 10,
      filters: []
    });
    expect(result.ids).toContain(listingId);

    await client!`delete from listing where id = ${listingId}`;
    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from "user" where id = ${ownerId}`;
  });
});
