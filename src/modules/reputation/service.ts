import {and, desc, eq, inArray, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  conversation,
  conversationMessage,
  listing,
  listingStatusHistory,
  outboxEvent,
  qualifiedInteraction,
  user,
  userReview
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {CreateReviewInput, PublicReputationQuery} from './contracts';
import {
  assertInteractionCanBeQualified,
  assertInteractionConfirmer,
  reviewSubjectId
} from './domain';
import {publicReviewVisibility} from './visibility';

const REVIEW_REVEAL_DELAY_MS = 14 * 24 * 60 * 60 * 1000;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

export async function qualifyConversation(
  db: DatabaseClient,
  actorId: string,
  conversationId: string
) {
  return db.transaction(async (transaction) => {
    const [reference] = await transaction
      .select({
        listingId: conversation.listingId,
        buyerId: conversation.buyerId,
        sellerId: conversation.sellerId
      })
      .from(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          or(eq(conversation.buyerId, actorId), eq(conversation.sellerId, actorId))
        )
      )
      .limit(1);
    if (!reference) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
    assertInteractionConfirmer(actorId, reference.sellerId);
    await lockParticipantPair(transaction, reference.buyerId, reference.sellerId);

    const [target] = await transaction
      .select({status: listing.status, version: listing.version})
      .from(listing)
      .where(eq(listing.id, reference.listingId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    const [thread] = await transaction
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.id, conversationId),
          or(eq(conversation.buyerId, actorId), eq(conversation.sellerId, actorId))
        )
      )
      .for('update')
      .limit(1);
    if (!thread) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);

    const [existing] = await transaction
      .select()
      .from(qualifiedInteraction)
      .where(eq(qualifiedInteraction.listingId, thread.listingId))
      .limit(1);
    if (existing) {
      if (existing.conversationId !== thread.id)
        throw new AppError('CONFLICT', 'The listing was sold through another conversation', 409);
      return {...serializeInteraction(existing), created: false as const};
    }

    const authors = await transaction
      .select({senderId: conversationMessage.senderId})
      .from(conversationMessage)
      .where(
        and(
          eq(conversationMessage.conversationId, thread.id),
          inArray(conversationMessage.senderId, [thread.buyerId, thread.sellerId])
        )
      )
      .groupBy(conversationMessage.senderId);
    const authorIds = new Set(authors.map(({senderId}) => senderId));
    assertInteractionCanBeQualified({
      actorId,
      buyerId: thread.buyerId,
      sellerId: thread.sellerId,
      conversationStatus: thread.status,
      listingStatus: target.status,
      buyerHasMessaged: authorIds.has(thread.buyerId),
      sellerHasMessaged: authorIds.has(thread.sellerId)
    });

    const now = new Date();
    const [created] = await transaction
      .insert(qualifiedInteraction)
      .values({
        listingId: thread.listingId,
        conversationId: thread.id,
        buyerId: thread.buyerId,
        sellerId: thread.sellerId,
        qualifiedBy: actorId,
        qualifiedAt: now
      })
      .returning();
    if (!created)
      throw new AppError('UNEXPECTED_ERROR', 'Qualified interaction was not created', 500);

    const [updated] = await transaction
      .update(listing)
      .set({
        status: 'sold',
        soldAt: now,
        version: sql`${listing.version} + 1`,
        updatedAt: now
      })
      .where(and(eq(listing.id, thread.listingId), eq(listing.status, 'active')))
      .returning({version: listing.version});
    if (!updated) throw new AppError('CONFLICT', 'Listing changed while confirming the sale', 409);

    await transaction.insert(listingStatusHistory).values({
      listingId: thread.listingId,
      actorId,
      fromStatus: 'active',
      toStatus: 'sold',
      reason: 'seller_confirmed_sale'
    });
    await transaction.insert(outboxEvent).values({
      aggregateType: 'listing',
      aggregateId: thread.listingId,
      eventType: 'listing.sold',
      aggregateVersion: updated.version,
      payload: {
        listingId: thread.listingId,
        interactionId: created.id,
        conversationId: thread.id
      }
    });
    return {...serializeInteraction(created), created: true as const};
  });
}

export async function createInteractionReview(
  db: DatabaseClient,
  actorId: string,
  interactionId: string,
  input: CreateReviewInput
) {
  return db.transaction(async (transaction) => {
    const interaction = await loadParticipantInteraction(transaction, actorId, interactionId);
    const subjectId = reviewSubjectId({...interaction, actorId});
    const normalizedBody = input.body ?? null;
    const [existing] = await transaction
      .select()
      .from(userReview)
      .where(and(eq(userReview.interactionId, interactionId), eq(userReview.authorId, actorId)))
      .limit(1);
    if (existing) {
      if (existing.rating !== input.rating || existing.body !== normalizedBody)
        throw new AppError('CONFLICT', 'A submitted review cannot be changed', 409);
      const counterpartExists = await hasActiveCounterpartReview(
        transaction,
        interactionId,
        subjectId
      );
      return serializeReview(existing, counterpartExists, false);
    }

    const counterpartExists = await hasActiveCounterpartReview(
      transaction,
      interactionId,
      subjectId
    );
    const now = new Date();
    const [created] = await transaction
      .insert(userReview)
      .values({
        interactionId,
        authorId: actorId,
        subjectId,
        rating: input.rating,
        body: normalizedBody,
        revealAt: new Date(now.getTime() + REVIEW_REVEAL_DELAY_MS)
      })
      .returning();
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Review was not created', 500);
    await transaction.insert(outboxEvent).values({
      aggregateType: 'user_review',
      aggregateId: created.id,
      eventType: 'reputation.review_submitted',
      aggregateVersion: 1,
      payload: {reviewId: created.id, interactionId, subjectId}
    });
    return serializeReview(created, counterpartExists, true);
  });
}

export async function getPublicReputationSummary(db: DatabaseClient, subjectId: string) {
  const [summary] = await db
    .select({
      average: sql<number>`coalesce(avg(${userReview.rating}), 0)::float8`,
      count: sql<number>`count(*)::int`
    })
    .from(userReview)
    .where(and(eq(userReview.subjectId, subjectId), publicReviewVisibility()));
  return {average: Number(summary?.average ?? 0), count: Number(summary?.count ?? 0)};
}

export async function getPublicReputation(
  db: DatabaseClient,
  subjectId: string,
  query: PublicReputationQuery
) {
  const [profile] = await db
    .select({id: user.id, name: user.name, createdAt: user.createdAt})
    .from(user)
    .where(eq(user.id, subjectId))
    .limit(1);
  if (!profile) throw new AppError('NOT_FOUND', 'Public profile was not found', 404);

  const visibility = publicReviewVisibility();
  const [summary, reviews] = await Promise.all([
    getPublicReputationSummary(db, subjectId),
    db
      .select({
        id: userReview.id,
        rating: userReview.rating,
        body: userReview.body,
        authorId: userReview.authorId,
        authorName: user.name,
        createdAt: userReview.createdAt
      })
      .from(userReview)
      .innerJoin(user, eq(user.id, userReview.authorId))
      .where(and(eq(userReview.subjectId, subjectId), visibility))
      .orderBy(desc(userReview.createdAt), desc(userReview.id))
      .limit(query.limit)
  ]);
  return {
    profile: {...profile, createdAt: profile.createdAt.toISOString()},
    summary,
    reviews: reviews.map((review) => ({
      ...review,
      createdAt: review.createdAt.toISOString()
    }))
  };
}

async function loadParticipantInteraction(
  transaction: DatabaseTransaction,
  actorId: string,
  interactionId: string
) {
  const [interaction] = await transaction
    .select()
    .from(qualifiedInteraction)
    .where(
      and(
        eq(qualifiedInteraction.id, interactionId),
        or(eq(qualifiedInteraction.buyerId, actorId), eq(qualifiedInteraction.sellerId, actorId))
      )
    )
    .for('update')
    .limit(1);
  if (!interaction) throw new AppError('NOT_FOUND', 'Qualified interaction was not found', 404);
  return interaction;
}

async function hasActiveCounterpartReview(
  transaction: DatabaseTransaction,
  interactionId: string,
  authorId: string
) {
  const [counterpart] = await transaction
    .select({id: userReview.id})
    .from(userReview)
    .where(
      and(
        eq(userReview.interactionId, interactionId),
        eq(userReview.authorId, authorId),
        eq(userReview.status, 'active')
      )
    )
    .limit(1);
  return Boolean(counterpart);
}

function serializeInteraction(row: typeof qualifiedInteraction.$inferSelect) {
  return {
    id: row.id,
    listingId: row.listingId,
    conversationId: row.conversationId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    qualifiedAt: row.qualifiedAt.toISOString()
  };
}

function serializeReview(
  row: typeof userReview.$inferSelect,
  counterpartExists: boolean,
  created: boolean
) {
  return {
    id: row.id,
    interactionId: row.interactionId,
    subjectId: row.subjectId,
    rating: row.rating,
    body: row.body,
    revealAt: row.revealAt.toISOString(),
    visible: row.status === 'active' && (counterpartExists || row.revealAt <= new Date()),
    created
  };
}

async function lockParticipantPair(
  transaction: DatabaseTransaction,
  firstUserId: string,
  secondUserId: string
) {
  const pair = [firstUserId, secondUserId].sort().join(':');
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`chat-pair:${pair}`}, 0))`
  );
}
