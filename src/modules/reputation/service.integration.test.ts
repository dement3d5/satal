import {randomUUID} from 'node:crypto';

import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {
  listConversations,
  sendConversationMessage,
  startConversation
} from '@/modules/chat/service';
import * as schema from '@/server/db/schema';

import {createInteractionReview, getPublicReputation, qualifyConversation} from './service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let client: ReturnType<typeof postgres> | undefined;

integration('qualified interactions and bilateral reviews', () => {
  beforeAll(() => {
    client = postgres(databaseUrl!, {max: 1, prepare: false});
  });

  afterAll(async () => {
    await client?.end();
  });

  it('qualifies only a real exchange, sells atomically and reveals reviews fairly', async () => {
    const sellerId = randomUUID();
    const buyerId = randomUUID();
    const outsiderId = randomUUID();
    const draftId = randomUUID();
    const listingId = randomUUID();
    const db = drizzle(client!, {schema});
    let conversationId: string | undefined;
    let interactionId: string | undefined;

    try {
      await client!`
        insert into "user" (id, name, email, email_verified)
        values
          (${sellerId}, 'Reputation seller', ${`${sellerId}@example.test`}, true),
          (${buyerId}, 'Reputation buyer', ${`${buyerId}@example.test`}, true),
          (${outsiderId}, 'Reputation outsider', ${`${outsiderId}@example.test`}, true)
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
          'Qualified interaction listing',
          'A complete description for reputation integration coverage.', now()
        )
      `;

      const started = await startConversation(db, buyerId, {
        listingId,
        clientMessageId: randomUUID(),
        body: 'Hello, I would like to buy this item.'
      });
      conversationId = started.conversationId;
      await expect(qualifyConversation(db, buyerId, conversationId)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await sendConversationMessage(db, sellerId, conversationId, {
        clientMessageId: randomUUID(),
        body: 'Agreed, the item is available for you.'
      });
      await expect(qualifyConversation(db, outsiderId, conversationId)).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });

      const qualified = await qualifyConversation(db, sellerId, conversationId);
      interactionId = qualified.id;
      expect(qualified).toMatchObject({
        created: true,
        buyerId,
        sellerId,
        listingId,
        conversationId
      });
      await expect(qualifyConversation(db, sellerId, conversationId)).resolves.toMatchObject({
        id: interactionId,
        created: false
      });
      await expect(qualifyConversation(db, buyerId, conversationId)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      const [sold] = await client!`
        select status, sold_at, version
        from listing
        where id = ${listingId}
      `;
      expect(sold).toMatchObject({status: 'sold', version: 2});
      expect(sold?.sold_at).toBeTruthy();

      const sellerThreads = await listConversations(db, sellerId, {locale: 'en', limit: 30});
      expect(sellerThreads[0]).toMatchObject({
        id: conversationId,
        listingStatus: 'sold',
        canQualify: false,
        interaction: {id: interactionId, review: null}
      });

      const buyerReview = await createInteractionReview(db, buyerId, interactionId, {
        rating: 5,
        body: 'Clear communication and an easy transaction.'
      });
      expect(buyerReview).toMatchObject({created: true, subjectId: sellerId, visible: false});
      await expect(
        createInteractionReview(db, outsiderId, interactionId, {rating: 1})
      ).rejects.toMatchObject({code: 'NOT_FOUND'});
      await expect(
        createInteractionReview(db, buyerId, interactionId, {
          rating: 5,
          body: 'Clear communication and an easy transaction.'
        })
      ).resolves.toMatchObject({id: buyerReview.id, created: false});
      await expect(
        createInteractionReview(db, buyerId, interactionId, {rating: 1})
      ).rejects.toMatchObject({code: 'CONFLICT'});

      const hiddenSellerProfile = await getPublicReputation(db, sellerId, {limit: 20});
      expect(hiddenSellerProfile).toMatchObject({summary: {average: 0, count: 0}, reviews: []});

      const sellerReview = await createInteractionReview(db, sellerId, interactionId, {
        rating: 4,
        body: 'The buyer was punctual and communicated clearly.'
      });
      expect(sellerReview).toMatchObject({created: true, subjectId: buyerId, visible: true});

      const [sellerProfile, buyerProfile, buyerThreads] = await Promise.all([
        getPublicReputation(db, sellerId, {limit: 20}),
        getPublicReputation(db, buyerId, {limit: 20}),
        listConversations(db, buyerId, {locale: 'en', limit: 30})
      ]);
      expect(sellerProfile.summary).toEqual({average: 5, count: 1});
      expect(sellerProfile.reviews[0]).toMatchObject({
        id: buyerReview.id,
        authorId: buyerId,
        rating: 5
      });
      expect(buyerProfile.summary).toEqual({average: 4, count: 1});
      expect(buyerProfile.reviews[0]).toMatchObject({id: sellerReview.id, authorId: sellerId});
      expect(buyerThreads[0]).toMatchObject({
        interaction: {id: interactionId, review: {id: buyerReview.id, visible: true}}
      });

      const [audit] = await client!`
        select
          (select count(*)::int from qualified_interaction where id = ${interactionId}) as interactions,
          (select count(*)::int from user_review where interaction_id = ${interactionId}) as reviews,
          (select count(*)::int from listing_status_history where listing_id = ${listingId} and to_status = 'sold') as sold_history,
          (select count(*)::int from outbox_event where aggregate_id = ${listingId} and event_type = 'listing.sold') as sold_events,
          (select count(*)::int from outbox_event where aggregate_type = 'user_review' and payload->>'interactionId' = ${interactionId}) as review_events
      `;
      expect(audit).toEqual({
        interactions: 1,
        reviews: 2,
        sold_history: 1,
        sold_events: 1,
        review_events: 2
      });
    } finally {
      if (interactionId) {
        await client!`
          delete from outbox_event
          where aggregate_type = 'user_review'
            and payload->>'interactionId' = ${interactionId}
        `;
        await client!`delete from user_review where interaction_id = ${interactionId}`;
        await client!`delete from qualified_interaction where id = ${interactionId}`;
      }
      await client!`delete from outbox_event where aggregate_type = 'listing' and aggregate_id = ${listingId}`;
      await client!`delete from listing_status_history where listing_id = ${listingId}`;
      if (conversationId) {
        await client!`
          delete from outbox_event
          where aggregate_type = 'conversation' and aggregate_id = ${conversationId}
        `;
        await client!`delete from conversation where id = ${conversationId}`;
      }
      await client!`delete from listing where id = ${listingId}`;
      await client!`delete from listing_draft where id = ${draftId}`;
      await client!`delete from "user" where id in (${sellerId}, ${buyerId}, ${outsiderId})`;
    }
  });
});
