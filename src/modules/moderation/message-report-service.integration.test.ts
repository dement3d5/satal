import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {sendConversationMessage, startConversation} from '@/modules/chat/service';
import * as schema from '@/server/db/schema';

import {
  createMessageReport,
  decideMessageReport,
  getOwnMessageReport,
  listModerationMessageReports
} from './message-report-service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('message reports persistence and permissions', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('keeps reports participant-only, excludes self-review and audits conversation closure', async () => {
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const secondBuyerId = randomUUID();
    const intruderId = randomUUID();
    const reviewerId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const db = drizzle(client!, {schema});

    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Message report seller', ${`${sellerId}@example.test`}, true),
          (${buyerId}, 'Message report buyer', ${`${buyerId}@example.test`}, true),
          (${secondBuyerId}, 'Second message buyer', ${`${secondBuyerId}@example.test`}, true),
          (${intruderId}, 'Message report intruder', ${`${intruderId}@example.test`}, true),
          (${reviewerId}, 'Message report reviewer', ${`${reviewerId}@example.test`}, true)
      `;
      await client!`
        insert into user_role (user_id, role, granted_by)
        values
          (${buyerId}, 'moderator', ${reviewerId}),
          (${reviewerId}, 'moderator', ${reviewerId})
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
          'Message report integration listing',
          'A complete description for message report integration coverage.', now()
        )
      `;

      const firstConversation = await startConversation(db, buyerId, {
        listingId,
        clientMessageId: randomUUID(),
        body: 'Is the advertised item still available?'
      });
      const sellerReply = await sendConversationMessage(
        db,
        sellerId,
        firstConversation.conversationId,
        {
          clientMessageId: randomUUID(),
          body: 'Send an advance payment before I answer any questions.'
        }
      );
      await expect(
        createMessageReport(
          db,
          intruderId,
          firstConversation.conversationId,
          sellerReply.message.id,
          {reason: 'fraud'}
        )
      ).rejects.toMatchObject({code: 'NOT_FOUND'});
      await expect(
        createMessageReport(
          db,
          buyerId,
          firstConversation.conversationId,
          firstConversation.message.id,
          {reason: 'spam'}
        )
      ).rejects.toMatchObject({code: 'FORBIDDEN'});

      const buyerReport = await createMessageReport(
        db,
        buyerId,
        firstConversation.conversationId,
        sellerReply.message.id,
        {reason: 'fraud', details: 'The sender requested an unsafe advance payment.'}
      );
      await expect(
        createMessageReport(db, buyerId, firstConversation.conversationId, sellerReply.message.id, {
          reason: 'spam'
        })
      ).resolves.toMatchObject({id: buyerReport.id, created: false, reason: 'fraud'});
      await expect(
        getOwnMessageReport(db, buyerId, firstConversation.conversationId, sellerReply.message.id)
      ).resolves.toMatchObject({id: buyerReport.id, reported: true});

      const sellerReport = await createMessageReport(
        db,
        sellerId,
        firstConversation.conversationId,
        firstConversation.message.id,
        {reason: 'harassment', details: 'The buyer continued with abusive language.'}
      );
      await expect(
        listModerationMessageReports(db, intruderId, {locale: 'en', limit: 30})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        listModerationMessageReports(db, buyerId, {locale: 'en', limit: 30})
      ).resolves.not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({conversationId: firstConversation.conversationId})
        ])
      );
      await expect(
        listModerationMessageReports(db, reviewerId, {locale: 'en', limit: 30})
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({reportId: buyerReport.id}),
          expect.objectContaining({reportId: sellerReport.id})
        ])
      );
      await expect(
        decideMessageReport(db, buyerId, buyerReport.id, {action: 'close_conversation'})
      ).rejects.toMatchObject({code: 'FORBIDDEN'});
      await expect(
        decideMessageReport(db, reviewerId, buyerReport.id, {action: 'close_conversation'})
      ).resolves.toMatchObject({
        conversationId: firstConversation.conversationId,
        reportStatus: 'resolved',
        conversationStatus: 'closed'
      });
      await expect(
        decideMessageReport(db, reviewerId, sellerReport.id, {action: 'dismiss'})
      ).rejects.toMatchObject({code: 'CONFLICT'});
      await expect(
        sendConversationMessage(db, buyerId, firstConversation.conversationId, {
          clientMessageId: randomUUID(),
          body: 'This message must not be accepted after enforcement.'
        })
      ).rejects.toMatchObject({code: 'CONFLICT'});

      const secondConversation = await startConversation(db, secondBuyerId, {
        listingId,
        clientMessageId: randomUUID(),
        body: 'Can you share more information about this listing?'
      });
      const secondReply = await sendConversationMessage(
        db,
        sellerId,
        secondConversation.conversationId,
        {
          clientMessageId: randomUUID(),
          body: 'Here is the additional information you requested.'
        }
      );
      const dismissed = await createMessageReport(
        db,
        secondBuyerId,
        secondConversation.conversationId,
        secondReply.message.id,
        {reason: 'spam'}
      );
      await expect(
        decideMessageReport(db, reviewerId, dismissed.id, {action: 'dismiss'})
      ).resolves.toMatchObject({
        reportStatus: 'dismissed',
        conversationStatus: 'open'
      });

      const [audit] = await client!`
        select
          (select status from conversation where id = ${firstConversation.conversationId}) as first_conversation_status,
          (select status from conversation where id = ${secondConversation.conversationId}) as second_conversation_status,
          (select count(*)::int from message_report where status = 'resolved' and id in (${buyerReport.id}, ${sellerReport.id})) as resolved_reports,
          (select count(*)::int from message_report where status = 'dismissed' and id = ${dismissed.id}) as dismissed_reports,
          (select count(*)::int from message_report_action where report_id in (${buyerReport.id}, ${sellerReport.id}, ${dismissed.id})) as actions
      `;
      expect(audit).toMatchObject({
        first_conversation_status: 'closed',
        second_conversation_status: 'open',
        resolved_reports: 2,
        dismissed_reports: 1,
        actions: 3
      });
    } finally {
      await client!`
        delete from outbox_event
        where (aggregate_type = 'message_report' and aggregate_id in (
          select mr.id
          from message_report mr
          join conversation_message cm on cm.id = mr.message_id
          join conversation c on c.id = cm.conversation_id
          where c.listing_id = ${listingId}
        )) or (aggregate_type = 'conversation' and aggregate_id in (
          select id from conversation where listing_id = ${listingId}
        )) or (aggregate_type = 'notification' and aggregate_id in (
          select n.id
          from notification n
          join conversation c on c.id = n.conversation_id
          where c.listing_id = ${listingId}
        ))
      `;
      await client!`
        delete from message_report_action
        where report_id in (
          select mr.id
          from message_report mr
          join conversation_message cm on cm.id = mr.message_id
          join conversation c on c.id = cm.conversation_id
          where c.listing_id = ${listingId}
        )
      `;
      await client!`
        delete from message_report
        where message_id in (
          select cm.id
          from conversation_message cm
          join conversation c on c.id = cm.conversation_id
          where c.listing_id = ${listingId}
        )
      `;
      await client!`delete from conversation where listing_id = ${listingId}`;
      await client!`delete from user_role where user_id in (${buyerId}, ${reviewerId})`;
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from "user" where id in (${sellerId}, ${buyerId}, ${secondBuyerId}, ${intruderId}, ${reviewerId})`;
    }
  });
});
