import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {
  addFavorite,
  createSavedSearch,
  deleteSavedSearch,
  getFavoriteStatus,
  listFavorites,
  listSavedSearches,
  removeFavorite,
  renameSavedSearch
} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('favorites and saved search ownership', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps engagement private to its owner and operations safe to retry', async () => {
    const ownerId = randomUUID();
    const intruderId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified)
      values
        (${ownerId}, 'Engagement owner', ${`${ownerId}@example.test`}, true),
        (${intruderId}, 'Engagement intruder', ${`${intruderId}@example.test`}, true)
    `;
    await client!`
      insert into listing_draft (id, owner_id, category_id, category_schema_version, status)
      values (${draftId}, ${ownerId}, '20000000-0000-4000-8000-000000000003', 1, 'submitted')
    `;
    await client!`
      insert into listing (
        id, seller_id, source_draft_id, category_id, category_schema_version,
        location_id, public_location_precision, status, title, description, published_at
      ) values (
        ${listingId}, ${ownerId}, ${draftId},
        '20000000-0000-4000-8000-000000000003', 1,
        '10000000-0000-4000-8000-000000000002', 'city', 'active',
        'Favorite integration listing',
        'A complete description for the engagement integration test.', now()
      )
    `;

    const db = drizzle(client!, {schema});
    await expect(addFavorite(db, ownerId, listingId)).resolves.toMatchObject({favorite: true});
    await expect(addFavorite(db, ownerId, listingId)).resolves.toMatchObject({favorite: true});
    await expect(getFavoriteStatus(db, intruderId, listingId)).resolves.toMatchObject({
      favorite: false
    });
    await expect(listFavorites(db, ownerId, 'en')).resolves.toHaveLength(1);

    const saved = await createSavedSearch(db, ownerId, {
      name: 'My cars',
      locale: 'en',
      query:
        'q=Toyota&categoryId=20000000-0000-4000-8000-000000000003&locationId=10000000-0000-4000-8000-000000000002&priceMax=25000'
    });
    expect(saved.href).toContain('q=Toyota');
    await expect(listSavedSearches(db, intruderId, 'en')).resolves.toEqual([]);
    await expect(renameSavedSearch(db, intruderId, saved.id, 'Stolen')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(deleteSavedSearch(db, intruderId, saved.id)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(renameSavedSearch(db, ownerId, saved.id, 'Updated cars')).resolves.toMatchObject({
      name: 'Updated cars'
    });
    await expect(deleteSavedSearch(db, ownerId, saved.id)).resolves.toMatchObject({deleted: true});
    await expect(removeFavorite(db, ownerId, listingId)).resolves.toMatchObject({favorite: false});

    await client!`delete from listing where id = ${listingId}`;
    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from "user" where id in (${ownerId}, ${intruderId})`;
  });
});
