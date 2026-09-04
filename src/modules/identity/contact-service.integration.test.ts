import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {revealListingContact} from './contact-service';
import {getOwnProfile, updateOwnProfile} from './profile-service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('identity profile and listing contact permissions', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('reveals only a verified active seller contact to another authenticated user', async () => {
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified, phone_number, phone_number_verified)
      values
        (${sellerId}, 'Contact seller', ${`${sellerId}@example.test`}, true, '+994501112233', true),
        (${buyerId}, 'Contact buyer', ${`${buyerId}@example.test`}, true, null, false)
    `;
    await client!`
      insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
      values (${draftId}, ${sellerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
    `;
    await client!`
      insert into listing (
        id, seller_id, source_draft_id, category_id, category_schema_version,
        location_id, public_location_precision, status, title, description, published_at
      ) values (
        ${listingId}, ${sellerId}, ${draftId},
        '20000000-0000-4000-8000-000000000003', 1,
        '10000000-0000-4000-8000-000000000002', 'city', 'active',
        'Contact integration listing',
        'A complete description for the contact integration test.', now()
      )
    `;

    const db = drizzle(client!, {schema});
    await expect(revealListingContact(db, sellerId, listingId)).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
    await expect(revealListingContact(db, buyerId, listingId)).resolves.toEqual({
      phoneNumber: '+994501112233',
      protocol: 'tel'
    });
    await expect(revealListingContact(db, buyerId, listingId)).resolves.toMatchObject({
      phoneNumber: '+994501112233'
    });
    const [audit] = await client!`
      select access_count from listing_contact_access
      where buyer_id = ${buyerId} and listing_id = ${listingId}
    `;
    expect(audit?.access_count).toBe(2);

    await expect(getOwnProfile(db, buyerId)).resolves.toMatchObject({name: 'Contact buyer'});
    await expect(updateOwnProfile(db, buyerId, 'Updated buyer')).resolves.toMatchObject({
      name: 'Updated buyer'
    });
    await expect(getOwnProfile(db, sellerId)).resolves.toMatchObject({name: 'Contact seller'});

    await client!`delete from listing where id = ${listingId}`;
    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from "user" where id in (${sellerId}, ${buyerId})`;
  });
});
