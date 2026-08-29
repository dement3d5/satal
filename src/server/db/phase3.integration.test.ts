import {randomUUID} from 'node:crypto';

import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('Phase 3 PostgreSQL model', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('seeds complete AZ/RU/EN translations for sample categories and locations', async () => {
    const [result] = await client!`
      select
        (select count(*)::int from category) as categories,
        (select count(*)::int from category_translation) as category_translations,
        (select count(*)::int from location) as locations,
        (select count(*)::int from location_translation) as location_translations
    `;

    expect(result).toMatchObject({
      categories: 9,
      category_translations: 27,
      locations: 6,
      location_translations: 18
    });
  });

  it('enforces category depth and draft ownership foreign keys', async () => {
    await expect(
      client!`insert into category (slug, depth) values (${`invalid-${randomUUID()}`}, 3)`
    ).rejects.toThrow();

    await expect(
      client!`
        insert into listing_draft (owner_id, category_id, category_schema_version)
        values (
          ${randomUUID()},
          '20000000-0000-4000-8000-000000000003',
          1
        )
      `
    ).rejects.toThrow();
  });

  it('enforces one typed scalar value and option-to-attribute ownership', async () => {
    const userId = randomUUID();
    const draftId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified)
      values (${userId}, 'Integration owner', ${`${userId}@example.test`}, true)
    `;
    await client!`
      insert into listing_draft (id, owner_id, category_id, category_schema_version)
      values (${draftId}, ${userId}, '20000000-0000-4000-8000-000000000003', 1)
    `;

    await expect(
      client!`
        insert into listing_draft_attribute_value
          (draft_id, attribute_id, text_value, integer_value)
        values (
          ${draftId},
          '30000000-0000-4000-8000-000000000003',
          'not-an-integer',
          2024
        )
      `
    ).rejects.toThrow();

    await expect(
      client!`
        insert into listing_draft_attribute_value (draft_id, attribute_id, option_id)
        values (
          ${draftId},
          '30000000-0000-4000-8000-000000000005',
          '40000000-0000-4000-8000-000000000001'
        )
      `
    ).rejects.toThrow();

    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from "user" where id = ${userId}`;
  });
});
