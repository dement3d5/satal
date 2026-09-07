import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreferences
} from '@/modules/notifications/service';
import * as schema from '@/server/db/schema';

import {
  blockConversationUser,
  listConversationMessages,
  listConversations,
  markConversationRead,
  sendConversationMessage,
  startConversation,
  unblockConversationUser
} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('listing conversations, blocks and notifications', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps messages participant-only, idempotent, block-aware and notification-backed', async () => {
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const intruderId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const firstClientMessageId = randomUUID();
    const replyClientMessageId = randomUUID();
    const mutedClientMessageId = randomUUID();
    const afterUnmuteClientMessageId = randomUUID();
    const db = drizzle(client!, {schema});

    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Chat seller', ${`${sellerId}@example.test`}, true),
          (${buyerId}, 'Chat buyer', ${`${buyerId}@example.test`}, true),
          (${intruderId}, 'Chat intruder', ${`${intruderId}@example.test`}, true)
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
          'Conversation integration listing',
          'A complete description for conversation integration coverage.', now()
        )
      `;

      await expect(
        startConversation(db, sellerId, {
          listingId,
          clientMessageId: randomUUID(),
          body: 'I cannot open a conversation with myself.'
        })
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      const started = await startConversation(db, buyerId, {
        listingId,
        clientMessageId: firstClientMessageId,
        body: 'Hello, is this item still available?'
      });
      expect(started).toMatchObject({created: true, conversationCreated: true});
      await expect(
        startConversation(db, buyerId, {
          listingId,
          clientMessageId: firstClientMessageId,
          body: 'A retry must not overwrite the original body.'
        })
      ).resolves.toMatchObject({created: false, conversationId: started.conversationId});
      await expect(
        listConversationMessages(db, intruderId, started.conversationId, {limit: 50})
      ).rejects.toMatchObject({code: 'NOT_FOUND'});

      await expect(listConversations(db, sellerId, {locale: 'en', limit: 30})).resolves.toEqual([
        expect.objectContaining({
          id: started.conversationId,
          unreadCount: 1,
          otherParticipant: expect.objectContaining({id: buyerId})
        })
      ]);
      await markConversationRead(db, sellerId, started.conversationId);
      const sellerNotifications = await listNotifications(db, sellerId, {
        limit: 50,
        unreadOnly: false
      });
      expect(sellerNotifications).toMatchObject({unreadCount: 0});
      expect(sellerNotifications.items).toHaveLength(1);

      const reply = await sendConversationMessage(db, sellerId, started.conversationId, {
        clientMessageId: replyClientMessageId,
        body: 'Yes, it is available.'
      });
      expect(reply.created).toBe(true);
      const buyerNotifications = await listNotifications(db, buyerId, {
        limit: 50,
        unreadOnly: true
      });
      expect(buyerNotifications).toMatchObject({unreadCount: 1});
      expect(buyerNotifications.items[0]).toMatchObject({conversationId: started.conversationId});
      await expect(
        markNotificationRead(db, intruderId, buyerNotifications.items[0]!.id)
      ).rejects.toMatchObject({code: 'NOT_FOUND'});
      const firstRead = await markNotificationRead(db, buyerId, buyerNotifications.items[0]!.id);
      await expect(
        markNotificationRead(db, buyerId, buyerNotifications.items[0]!.id)
      ).resolves.toEqual(firstRead);

      await blockConversationUser(db, buyerId, sellerId);
      await expect(
        sendConversationMessage(db, sellerId, started.conversationId, {
          clientMessageId: randomUUID(),
          body: 'This new message must be blocked.'
        })
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        sendConversationMessage(db, sellerId, started.conversationId, {
          clientMessageId: replyClientMessageId,
          body: 'An idempotent retry still returns the persisted message.'
        })
      ).resolves.toMatchObject({created: false, message: {id: reply.message.id}});
      await unblockConversationUser(db, buyerId, sellerId);

      expect(await getNotificationPreferences(db, buyerId)).toMatchObject({inAppEnabled: true});
      await updateNotificationPreferences(db, buyerId, {inAppEnabled: false});
      await sendConversationMessage(db, sellerId, started.conversationId, {
        clientMessageId: mutedClientMessageId,
        body: 'This message should not create an in-app notification.'
      });
      const mutedNotifications = await listNotifications(db, buyerId, {
        limit: 50,
        unreadOnly: false
      });
      expect(mutedNotifications.items).toHaveLength(1);
      await expect(
        updateNotificationPreferences(db, buyerId, {emailEnabled: true})
      ).rejects.toMatchObject({code: 'SERVICE_UNAVAILABLE'});

      await updateNotificationPreferences(db, buyerId, {inAppEnabled: true});
      await sendConversationMessage(db, sellerId, started.conversationId, {
        clientMessageId: afterUnmuteClientMessageId,
        body: 'In-app notifications are enabled again.'
      });
      const messagePage = await listConversationMessages(db, buyerId, started.conversationId, {
        beforeSequence: 5,
        limit: 2
      });
      expect(messagePage.items).toHaveLength(2);
      expect(messagePage.nextBeforeSequence).toBe(3);
      await markConversationRead(db, buyerId, started.conversationId);
      await expect(listConversations(db, buyerId, {locale: 'en', limit: 30})).resolves.toEqual([
        expect.objectContaining({unreadCount: 0, canSend: true})
      ]);

      const audit = await client!`
        select
          (select count(*)::int from conversation_message where conversation_id = ${started.conversationId}) as messages,
          (select count(*)::int from notification where conversation_id = ${started.conversationId}) as notifications,
          (select count(*)::int from notification_delivery where notification_id in (select id from notification where conversation_id = ${started.conversationId})) as deliveries
      `;
      expect(audit[0]).toMatchObject({messages: 4, notifications: 3, deliveries: 3});
    } finally {
      await client!`
        delete from outbox_event
        where (aggregate_type = 'conversation' and aggregate_id in (
          select id from conversation where listing_id = ${listingId}
        )) or (aggregate_type = 'notification' and aggregate_id in (
          select id from notification where conversation_id in (
            select id from conversation where listing_id = ${listingId}
          )
        ))
      `;
      await client!`delete from user_block where blocker_id in (${sellerId}, ${buyerId}, ${intruderId}) or blocked_id in (${sellerId}, ${buyerId}, ${intruderId})`;
      await client!`delete from conversation where listing_id = ${listingId}`;
      await client!`delete from notification_preference where user_id in (${sellerId}, ${buyerId}, ${intruderId})`;
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from "user" where id in (${sellerId}, ${buyerId}, ${intruderId})`;
    }
  });
});
