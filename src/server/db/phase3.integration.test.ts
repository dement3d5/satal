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
      locations: 31,
      location_translations: 93
    });
  });

  it('seeds the complete verified Baku metro list and an expanded passenger make catalog', async () => {
    const [result] = await client!`
      select
        (
          select count(distinct location.id)::int
          from location
          where location.kind = 'metro'
            and location.parent_id = '10000000-0000-4000-8000-000000000002'
            and location.verified_at is not null
        ) as metro_stations,
        (
          select count(*)::int
          from attribute_option
          where attribute_id = '30000000-0000-4000-8000-000000000001'
            and enabled = true
        ) as vehicle_makes,
        (
          select enabled
          from attribute_option
          where id = '40000000-0000-4000-8000-000000000001'
        ) as other_make_enabled
    `;

    expect(result).toMatchObject({metro_stations: 26, other_make_enabled: false});
    expect(result!.vehicle_makes).toBeGreaterThan(100);
  });

  it('seeds distinct filter schemas for launch apartments and cars', async () => {
    const rows = await client!`
      select category.slug, attribute_definition.key
      from category_attribute
      join category on category.id = category_attribute.category_id
      join attribute_definition on attribute_definition.id = category_attribute.attribute_id
      where category.slug in ('apartments-for-sale', 'passenger-cars')
        and category_attribute.filterable = true
      order by category.slug, category_attribute.sort_order
    `;
    const keys = (slug: string) =>
      rows.filter((row) => row.slug === slug).map((row) => row.key as string);

    expect(keys('apartments-for-sale')).toEqual(
      expect.arrayContaining([
        'property_type',
        'bedrooms',
        'area',
        'floor',
        'repair_condition',
        'deed_available',
        'mortgage_available'
      ])
    );
    expect(keys('apartments-for-sale')).not.toContain('total_floors');
    expect(keys('passenger-cars')).toEqual(
      expect.arrayContaining([
        'brand',
        'year',
        'mileage',
        'condition',
        'engine_volume',
        'fuel_type',
        'transmission',
        'body_type'
      ])
    );
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

  it('enforces one published listing per source draft and active publication timestamps', async () => {
    const userId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified)
      values (${userId}, 'Publication owner', ${`${userId}@example.test`}, true)
    `;
    await client!`
      insert into listing_draft
        (id, owner_id, category_id, category_schema_version, location_id, title, description)
      values (
        ${draftId},
        ${userId},
        '20000000-0000-4000-8000-000000000003',
        1,
        '10000000-0000-4000-8000-000000000002',
        'Integration listing',
        'A sufficiently complete integration listing description.'
      )
    `;

    await expect(
      client!`
        insert into listing
          (seller_id, source_draft_id, category_id, category_schema_version, location_id,
           public_location_precision, status, title, description)
        values (
          ${userId}, ${draftId}, '20000000-0000-4000-8000-000000000003', 1,
          '10000000-0000-4000-8000-000000000002', 'city', 'active',
          'Missing published date', 'This active listing intentionally lacks a publication date.'
        )
      `
    ).rejects.toThrow();

    await client!`
      insert into listing
        (id, seller_id, source_draft_id, category_id, category_schema_version, location_id,
         public_location_precision, status, title, description, published_at)
      values (
        ${listingId}, ${userId}, ${draftId}, '20000000-0000-4000-8000-000000000003', 1,
        '10000000-0000-4000-8000-000000000002', 'city', 'active',
        'Published integration listing', 'A complete published integration listing description.', now()
      )
    `;
    await expect(
      client!`
        insert into listing
          (seller_id, source_draft_id, category_id, category_schema_version, location_id,
           public_location_precision, status, title, description, published_at)
        values (
          ${userId}, ${draftId}, '20000000-0000-4000-8000-000000000003', 1,
          '10000000-0000-4000-8000-000000000002', 'city', 'active',
          'Duplicate publication', 'This duplicate must be rejected by the source draft key.', now()
        )
      `
    ).rejects.toThrow();

    await client!`delete from listing where id = ${listingId}`;
    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from "user" where id = ${userId}`;
  });
});
