import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {createListingDraft} from '@/modules/listings/draft-service';
import * as schema from '@/server/db/schema';

import {
  addShopMember,
  createShop,
  decideShopVerification,
  getPublicShop,
  listVerificationQueue,
  submitShopVerification,
  updateShop
} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('shop ownership, permissions and verification lifecycle', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps shop operations scoped and publishes only approved verification', async () => {
    const ownerId = randomUUID();
    const managerId = randomUUID();
    const outsiderId = randomUUID();
    const adminId = randomUUID();
    const draftIds: string[] = [];
    let shopId: string | undefined;
    const db = drizzle(client!, {schema});
    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${ownerId}, 'Shop owner', ${`${ownerId}@example.test`}, true),
          (${managerId}, 'Shop manager', ${`${managerId}@example.test`}, true),
          (${outsiderId}, 'Shop outsider', ${`${outsiderId}@example.test`}, true),
          (${adminId}, 'Shop admin', ${`${adminId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values (${adminId}, 'admin', ${adminId})
      `;

      const created = await createShop(db, ownerId, {
        name: 'Integration Market',
        description: 'A public test storefront.',
        locationId: '10000000-0000-4000-8000-000000000002',
        publicAddress: 'Test business address',
        publicPhone: '+994501112233',
        businessHours: [
          {weekday: 1, isClosed: false, opensAtMinute: 540, closesAtMinute: 1080},
          {weekday: 0, isClosed: true}
        ]
      });
      shopId = created.id;
      expect(created).toMatchObject({role: 'owner', verificationStatus: 'unverified'});

      await addShopMember(db, ownerId, created.id, {
        email: `${managerId}@example.test`,
        role: 'manager'
      });
      const updated = await updateShop(db, managerId, created.id, {
        version: created.version,
        description: 'Updated safely by a delegated manager.'
      });
      expect(updated.description).toContain('delegated manager');
      await expect(
        updateShop(db, outsiderId, created.id, {version: updated.version, name: 'Taken over'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      const shopDraft = await createListingDraft(
        db,
        managerId,
        '20000000-0000-4000-8000-000000000003',
        created.id
      );
      draftIds.push(shopDraft.id);
      expect(shopDraft.shopId).toBe(created.id);
      await expect(
        createListingDraft(db, outsiderId, '20000000-0000-4000-8000-000000000003', created.id)
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      const request = await submitShopVerification(db, ownerId, created.id, {
        legalName: 'Integration Market LLC',
        registryNumber: 'TEST-123',
        statement: 'This shop is operated by the registered integration test business.'
      });
      expect(request.status).toBe('pending');
      await expect(
        submitShopVerification(db, ownerId, created.id, {
          legalName: 'Integration Market LLC',
          registryNumber: null,
          statement: 'A second request must not be accepted while review is pending.'
        })
      ).rejects.toMatchObject({code: 'CONFLICT'});

      const queue = await listVerificationQueue(db, adminId);
      expect(queue.some((item) => item.id === request.id)).toBe(true);
      await expect(listVerificationQueue(db, outsiderId)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      const decision = await decideShopVerification(db, adminId, request.id, {
        decision: 'approve',
        reviewerNote: 'Registry and public storefront details were checked.'
      });
      expect(decision.status).toBe('approved');

      const storefront = await getPublicShop(db, 'en', created.slug);
      expect(storefront).toMatchObject({
        name: 'Integration Market',
        verificationStatus: 'verified'
      });
      const renamed = await updateShop(db, ownerId, created.id, {
        version: updated.version,
        name: 'Integration Market Updated'
      });
      expect(renamed.verificationStatus).toBe('unverified');
    } finally {
      if (shopId) {
        if (draftIds.length) {
          await client!`delete from listing_draft where id in ${client!(draftIds)}`;
        }
        await client!`delete from shop_verification_request where shop_id = ${shopId}`;
        await client!`delete from shop where id = ${shopId}`;
      }
      await client!`delete from user_role where user_id = ${adminId}`;
      await client!`delete from "user" where id in (${ownerId}, ${managerId}, ${outsiderId}, ${adminId})`;
    }
  });
});
