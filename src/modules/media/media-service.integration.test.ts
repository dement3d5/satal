import {createHash, randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import * as schema from '@/server/db/schema';

import {authorizeDraftMediaUpload, receiveQuarantinedUpload} from './media-service';
import type {QuarantineStorage} from './storage';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('media ownership and quarantine persistence', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('rejects IDOR and consumes an exact upload capability once', async () => {
    const ownerId = randomUUID();
    const intruderId = randomUUID();
    const draftId = randomUUID();
    await client!`
      insert into "user" (id, name, email, email_verified)
      values
        (${ownerId}, 'Media owner', ${`${ownerId}@example.test`}, true),
        (${intruderId}, 'Media intruder', ${`${intruderId}@example.test`}, true)
    `;
    await client!`
      insert into listing_draft (id, owner_id, category_id, category_schema_version)
      values (${draftId}, ${ownerId}, '20000000-0000-4000-8000-000000000003', 1)
    `;

    const db = drizzle(client!, {schema});
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await expect(
      authorizeDraftMediaUpload(db, intruderId, draftId, {
        mediaType: 'image/jpeg',
        bytes: bytes.byteLength,
        sha256
      })
    ).rejects.toMatchObject({code: 'FORBIDDEN'});

    const authorization = await authorizeDraftMediaUpload(db, ownerId, draftId, {
      mediaType: 'image/jpeg',
      bytes: bytes.byteLength,
      sha256
    });
    const written: Uint8Array[] = [];
    const storage: QuarantineStorage = {
      put: (_key, value) => {
        written.push(value);
        return Promise.resolve();
      }
    };
    await expect(
      receiveQuarantinedUpload(
        db,
        authorization.media.assetId,
        authorization.upload.token,
        bytes,
        storage
      )
    ).resolves.toMatchObject({status: 'quarantined'});
    expect(written).toHaveLength(1);
    await expect(
      receiveQuarantinedUpload(
        db,
        authorization.media.assetId,
        authorization.upload.token,
        bytes,
        storage
      )
    ).rejects.toMatchObject({code: 'CONFLICT'});

    await client!`delete from listing_draft where id = ${draftId}`;
    await client!`delete from media_asset where owner_id = ${ownerId}`;
    await client!`delete from "user" where id in (${ownerId}, ${intruderId})`;
  });
});
