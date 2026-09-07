import {and, count, desc, eq, gt, inArray, isNull, lt, or, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  conversation,
  conversationMessage,
  listing,
  notification,
  notificationDelivery,
  notificationPreference,
  outboxEvent,
  qualifiedInteraction,
  user,
  userBlock,
  userReview
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {
  ConversationListQuery,
  MessageListQuery,
  SendMessageInput,
  StartConversationInput
} from './contracts';
import {
  assertConversationCanSend,
  assertConversationCanStart,
  assertConversationParticipant,
  otherParticipantId
} from './domain';

const MESSAGE_LIMIT_PER_MINUTE = 30;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
type ConversationRow = typeof conversation.$inferSelect;

export async function startConversation(
  db: DatabaseClient,
  actorId: string,
  input: StartConversationInput
) {
  return db.transaction(async (transaction) => {
    await lockActor(transaction, actorId);
    const [listingReference] = await transaction
      .select({id: listing.id, sellerId: listing.sellerId, status: listing.status})
      .from(listing)
      .where(eq(listing.id, input.listingId))
      .limit(1);
    if (!listingReference) throw new AppError('NOT_FOUND', 'Listing was not found', 404);
    await lockParticipantPair(transaction, actorId, listingReference.sellerId);
    const [target] = await transaction
      .select({id: listing.id, sellerId: listing.sellerId, status: listing.status})
      .from(listing)
      .where(eq(listing.id, input.listingId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Listing was not found', 404);

    let [thread] = await transaction
      .select()
      .from(conversation)
      .where(and(eq(conversation.listingId, input.listingId), eq(conversation.buyerId, actorId)))
      .for('update')
      .limit(1);

    if (!thread) {
      const blocked = await hasBlock(transaction, actorId, target.sellerId);
      assertConversationCanStart({
        buyerId: actorId,
        sellerId: target.sellerId,
        listingStatus: target.status,
        blocked
      });
      [thread] = await transaction
        .insert(conversation)
        .values({listingId: input.listingId, buyerId: actorId, sellerId: target.sellerId})
        .returning();
      if (!thread) throw new AppError('UNEXPECTED_ERROR', 'Conversation was not created', 500);
    }

    const result = await persistMessage(transaction, actorId, thread, target.status, input);
    return {...result, conversationCreated: thread.lastMessageSequence === 0};
  });
}

export async function sendConversationMessage(
  db: DatabaseClient,
  actorId: string,
  conversationId: string,
  input: SendMessageInput
) {
  return db.transaction(async (transaction) => {
    await lockActor(transaction, actorId);
    const [reference] = await transaction
      .select({
        listingId: conversation.listingId,
        buyerId: conversation.buyerId,
        sellerId: conversation.sellerId
      })
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    if (!reference) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
    assertConversationParticipant({...reference, actorId});
    await lockParticipantPair(transaction, reference.buyerId, reference.sellerId);
    const [target] = await transaction
      .select({status: listing.status})
      .from(listing)
      .where(eq(listing.id, reference.listingId))
      .for('update')
      .limit(1);
    if (!target) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
    const [thread] = await transaction
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .for('update')
      .limit(1);
    if (!thread) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
    return persistMessage(transaction, actorId, thread, target.status, input);
  });
}

export async function listConversations(
  db: DatabaseClient,
  actorId: string,
  query: ConversationListQuery
) {
  const rows = await db
    .select({
      id: conversation.id,
      listingId: conversation.listingId,
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      status: conversation.status,
      lastMessageSequence: conversation.lastMessageSequence,
      buyerReadSequence: conversation.buyerReadSequence,
      sellerReadSequence: conversation.sellerReadSequence,
      lastMessageAt: conversation.lastMessageAt,
      listingTitle: listing.title,
      listingStatus: listing.status,
      lastMessageBody: conversationMessage.body,
      lastMessageSenderId: conversationMessage.senderId
    })
    .from(conversation)
    .innerJoin(listing, eq(listing.id, conversation.listingId))
    .leftJoin(
      conversationMessage,
      and(
        eq(conversationMessage.conversationId, conversation.id),
        eq(conversationMessage.sequence, conversation.lastMessageSequence)
      )
    )
    .where(or(eq(conversation.buyerId, actorId), eq(conversation.sellerId, actorId)))
    .orderBy(desc(conversation.lastMessageAt), desc(conversation.updatedAt), desc(conversation.id))
    .limit(query.limit);

  const otherIds = [
    ...new Set(rows.map((row) => (row.buyerId === actorId ? row.sellerId : row.buyerId)))
  ];
  const conversationIds = rows.map((row) => row.id);
  const listingIds = [...new Set(rows.map((row) => row.listingId))];
  const [people, blocks, interactions, messageAuthors] = await Promise.all([
    otherIds.length
      ? db.select({id: user.id, name: user.name}).from(user).where(inArray(user.id, otherIds))
      : [],
    otherIds.length
      ? db
          .select({blockerId: userBlock.blockerId, blockedId: userBlock.blockedId})
          .from(userBlock)
          .where(
            or(
              and(eq(userBlock.blockerId, actorId), inArray(userBlock.blockedId, otherIds)),
              and(eq(userBlock.blockedId, actorId), inArray(userBlock.blockerId, otherIds))
            )
          )
      : [],
    listingIds.length
      ? db
          .select()
          .from(qualifiedInteraction)
          .where(inArray(qualifiedInteraction.listingId, listingIds))
      : [],
    conversationIds.length
      ? db
          .select({
            conversationId: conversationMessage.conversationId,
            senderId: conversationMessage.senderId
          })
          .from(conversationMessage)
          .where(inArray(conversationMessage.conversationId, conversationIds))
          .groupBy(conversationMessage.conversationId, conversationMessage.senderId)
      : []
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const interactionIds = interactions.map((item) => item.id);
  const reviews = interactionIds.length
    ? await db.select().from(userReview).where(inArray(userReview.interactionId, interactionIds))
    : [];
  const interactionByConversation = new Map(
    interactions.map((interaction) => [interaction.conversationId, interaction])
  );
  const interactionByListing = new Map(
    interactions.map((interaction) => [interaction.listingId, interaction])
  );
  const messageAuthorKeys = new Set(
    messageAuthors.map((item) => `${item.conversationId}:${item.senderId}`)
  );
  const ownReviewByInteraction = new Map(
    reviews
      .filter((review) => review.authorId === actorId)
      .map((review) => [review.interactionId, review])
  );
  const activeCounterpartReviewInteractions = new Set(
    reviews
      .filter((review) => review.authorId !== actorId && review.status === 'active')
      .map((review) => review.interactionId)
  );

  return rows.map((row) => {
    const role = row.buyerId === actorId ? ('buyer' as const) : ('seller' as const);
    const otherId = role === 'buyer' ? row.sellerId : row.buyerId;
    const blockedByYou = blocks.some(
      (block) => block.blockerId === actorId && block.blockedId === otherId
    );
    const blockedByOther = blocks.some(
      (block) => block.blockerId === otherId && block.blockedId === actorId
    );
    const readSequence = role === 'buyer' ? row.buyerReadSequence : row.sellerReadSequence;
    const interaction = interactionByConversation.get(row.id);
    const ownReview = interaction ? ownReviewByInteraction.get(interaction.id) : undefined;
    return {
      id: row.id,
      status: row.status,
      listingId: row.listingId,
      listingTitle: row.listingTitle,
      listingStatus: row.listingStatus,
      role,
      otherParticipant: {id: otherId, name: names.get(otherId) ?? ''},
      lastMessage:
        row.lastMessageBody && row.lastMessageAt
          ? {
              body: row.lastMessageBody,
              sentByMe: row.lastMessageSenderId === actorId,
              createdAt: row.lastMessageAt.toISOString()
            }
          : null,
      unreadCount: Math.max(0, row.lastMessageSequence - readSequence),
      blockedByYou,
      blockedByOther,
      canQualify:
        role === 'seller' &&
        row.status === 'open' &&
        row.listingStatus === 'active' &&
        !interactionByListing.has(row.listingId) &&
        messageAuthorKeys.has(`${row.id}:${row.buyerId}`) &&
        messageAuthorKeys.has(`${row.id}:${row.sellerId}`),
      interaction: interaction
        ? {
            id: interaction.id,
            qualifiedAt: interaction.qualifiedAt.toISOString(),
            review: ownReview
              ? {
                  id: ownReview.id,
                  rating: ownReview.rating,
                  body: ownReview.body,
                  revealAt: ownReview.revealAt.toISOString(),
                  visible:
                    ownReview.status === 'active' &&
                    (activeCounterpartReviewInteractions.has(interaction.id) ||
                      ownReview.revealAt <= new Date())
                }
              : null
          }
        : null,
      canSend:
        row.status === 'open' &&
        (row.listingStatus === 'active' || row.listingStatus === 'sold') &&
        !blockedByYou &&
        !blockedByOther,
      href: `/${query.locale}/messages?conversation=${row.id}`
    };
  });
}

export async function listConversationMessages(
  db: DatabaseClient,
  actorId: string,
  conversationId: string,
  query: MessageListQuery
) {
  const [thread] = await db
    .select({buyerId: conversation.buyerId, sellerId: conversation.sellerId})
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        or(eq(conversation.buyerId, actorId), eq(conversation.sellerId, actorId))
      )
    )
    .limit(1);
  if (!thread) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);

  const rows = await db
    .select({
      id: conversationMessage.id,
      sequence: conversationMessage.sequence,
      senderId: conversationMessage.senderId,
      senderName: user.name,
      body: conversationMessage.body,
      createdAt: conversationMessage.createdAt
    })
    .from(conversationMessage)
    .innerJoin(user, eq(user.id, conversationMessage.senderId))
    .where(
      and(
        eq(conversationMessage.conversationId, conversationId),
        query.beforeSequence ? lt(conversationMessage.sequence, query.beforeSequence) : undefined
      )
    )
    .orderBy(desc(conversationMessage.sequence))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const selected = rows.slice(0, query.limit);
  const nextBeforeSequence = hasMore ? (selected.at(-1)?.sequence ?? null) : null;
  return {
    items: selected.toReversed().map((row) => ({
      ...row,
      sentByMe: row.senderId === actorId,
      createdAt: row.createdAt.toISOString()
    })),
    nextBeforeSequence
  };
}

export async function markConversationRead(
  db: DatabaseClient,
  actorId: string,
  conversationId: string
) {
  return db.transaction(async (transaction) => {
    const [thread] = await transaction
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .for('update')
      .limit(1);
    if (!thread) throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
    const role = assertConversationParticipant({...thread, actorId});
    const now = new Date();
    await transaction
      .update(conversation)
      .set({
        ...(role === 'buyer'
          ? {buyerReadSequence: thread.lastMessageSequence}
          : {sellerReadSequence: thread.lastMessageSequence}),
        updatedAt: now
      })
      .where(eq(conversation.id, conversationId));
    await transaction
      .update(notification)
      .set({readAt: now})
      .where(
        and(
          eq(notification.recipientId, actorId),
          eq(notification.conversationId, conversationId),
          isNull(notification.readAt)
        )
      );
    return {conversationId, readSequence: thread.lastMessageSequence};
  });
}

export async function blockConversationUser(
  db: DatabaseClient,
  actorId: string,
  blockedId: string
) {
  if (actorId === blockedId) throw new AppError('BAD_REQUEST', 'You cannot block yourself', 400);
  return db.transaction(async (transaction) => {
    await lockParticipantPair(transaction, actorId, blockedId);
    await lockSharedConversations(transaction, actorId, blockedId);
    const [created] = await transaction
      .insert(userBlock)
      .values({blockerId: actorId, blockedId})
      .onConflictDoNothing()
      .returning({blockedId: userBlock.blockedId});
    return {userId: blockedId, blocked: true as const, created: Boolean(created)};
  });
}

export async function unblockConversationUser(
  db: DatabaseClient,
  actorId: string,
  blockedId: string
) {
  if (actorId === blockedId) throw new AppError('BAD_REQUEST', 'You cannot unblock yourself', 400);
  return db.transaction(async (transaction) => {
    await lockParticipantPair(transaction, actorId, blockedId);
    await lockSharedConversations(transaction, actorId, blockedId);
    const [removed] = await transaction
      .delete(userBlock)
      .where(and(eq(userBlock.blockerId, actorId), eq(userBlock.blockedId, blockedId)))
      .returning({blockedId: userBlock.blockedId});
    return {userId: blockedId, blocked: false as const, removed: Boolean(removed)};
  });
}

async function persistMessage(
  transaction: DatabaseTransaction,
  actorId: string,
  thread: ConversationRow,
  listingStatus: typeof listing.$inferSelect.status,
  input: SendMessageInput
) {
  const role = assertConversationParticipant({...thread, actorId});
  const [existing] = await transaction
    .select({
      id: conversationMessage.id,
      sequence: conversationMessage.sequence,
      body: conversationMessage.body,
      createdAt: conversationMessage.createdAt
    })
    .from(conversationMessage)
    .where(
      and(
        eq(conversationMessage.conversationId, thread.id),
        eq(conversationMessage.senderId, actorId),
        eq(conversationMessage.clientMessageId, input.clientMessageId)
      )
    )
    .limit(1);
  if (existing)
    return {
      conversationId: thread.id,
      message: {...existing, sentByMe: true as const, createdAt: existing.createdAt.toISOString()},
      created: false as const
    };

  const recipientId = otherParticipantId({...thread, actorId});
  const blocked = await hasBlock(transaction, actorId, recipientId);
  assertConversationCanSend({
    actorId,
    buyerId: thread.buyerId,
    sellerId: thread.sellerId,
    conversationStatus: thread.status,
    listingStatus,
    blocked
  });

  const since = new Date(Date.now() - 60 * 1000);
  const [recent] = await transaction
    .select({value: count()})
    .from(conversationMessage)
    .where(
      and(eq(conversationMessage.senderId, actorId), gt(conversationMessage.createdAt, since))
    );
  if ((recent?.value ?? 0) >= MESSAGE_LIMIT_PER_MINUTE)
    throw new AppError('RATE_LIMITED', 'Message rate limit reached', 429);

  const now = new Date();
  const sequence = thread.lastMessageSequence + 1;
  const [created] = await transaction
    .insert(conversationMessage)
    .values({
      conversationId: thread.id,
      sequence,
      senderId: actorId,
      clientMessageId: input.clientMessageId,
      body: input.body
    })
    .returning({
      id: conversationMessage.id,
      sequence: conversationMessage.sequence,
      body: conversationMessage.body,
      createdAt: conversationMessage.createdAt
    });
  if (!created) throw new AppError('UNEXPECTED_ERROR', 'Message was not created', 500);

  await transaction
    .update(conversation)
    .set({
      lastMessageSequence: sequence,
      lastMessageAt: now,
      ...(role === 'buyer' ? {buyerReadSequence: sequence} : {sellerReadSequence: sequence}),
      updatedAt: now
    })
    .where(eq(conversation.id, thread.id));

  const [preference] = await transaction
    .select({
      inAppEnabled: notificationPreference.inAppEnabled,
      emailEnabled: notificationPreference.emailEnabled,
      pushEnabled: notificationPreference.pushEnabled
    })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.userId, recipientId),
        eq(notificationPreference.type, 'chat_message')
      )
    )
    .limit(1);
  const enabledChannels = [
    ...(preference?.inAppEnabled === false ? [] : (['in_app'] as const)),
    ...(preference?.emailEnabled ? (['email'] as const) : []),
    ...(preference?.pushEnabled ? (['push'] as const) : [])
  ];

  let notificationId: string | null = null;
  if (enabledChannels.length) {
    const [createdNotification] = await transaction
      .insert(notification)
      .values({
        recipientId,
        type: 'chat_message',
        actorId,
        listingId: thread.listingId,
        conversationId: thread.id,
        messageId: created.id
      })
      .returning({id: notification.id});
    if (!createdNotification)
      throw new AppError('UNEXPECTED_ERROR', 'Notification was not created', 500);
    notificationId = createdNotification.id;
    await transaction.insert(notificationDelivery).values(
      enabledChannels.map((channel) => ({
        notificationId: createdNotification.id,
        channel,
        status: channel === 'in_app' ? ('delivered' as const) : ('pending' as const),
        deliveredAt: channel === 'in_app' ? now : null
      }))
    );
    const externalChannels = enabledChannels.filter((channel) => channel !== 'in_app');
    if (externalChannels.length) {
      await transaction.insert(outboxEvent).values({
        aggregateType: 'notification',
        aggregateId: createdNotification.id,
        eventType: 'notification.delivery_requested',
        aggregateVersion: 1,
        payload: {notificationId: createdNotification.id, channels: externalChannels}
      });
    }
  }

  await transaction.insert(outboxEvent).values({
    aggregateType: 'conversation',
    aggregateId: thread.id,
    eventType: 'chat.message_sent',
    aggregateVersion: sequence,
    payload: {
      conversationId: thread.id,
      messageId: created.id,
      recipientId,
      notificationId
    }
  });
  return {
    conversationId: thread.id,
    message: {...created, sentByMe: true as const, createdAt: created.createdAt.toISOString()},
    created: true as const
  };
}

async function lockActor(transaction: DatabaseTransaction, actorId: string) {
  const [actor] = await transaction
    .select({id: user.id})
    .from(user)
    .where(eq(user.id, actorId))
    .for('update')
    .limit(1);
  if (!actor) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);
}

type ReadDatabase = Pick<DatabaseClient, 'select'>;

async function hasBlock(db: ReadDatabase, firstUserId: string, secondUserId: string) {
  const [block] = await db
    .select({blockerId: userBlock.blockerId})
    .from(userBlock)
    .where(
      or(
        and(eq(userBlock.blockerId, firstUserId), eq(userBlock.blockedId, secondUserId)),
        and(eq(userBlock.blockerId, secondUserId), eq(userBlock.blockedId, firstUserId))
      )
    )
    .limit(1);
  return Boolean(block);
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

async function lockSharedConversations(
  transaction: DatabaseTransaction,
  actorId: string,
  otherId: string
) {
  const shared = await transaction
    .select({id: conversation.id})
    .from(conversation)
    .where(
      or(
        and(eq(conversation.buyerId, actorId), eq(conversation.sellerId, otherId)),
        and(eq(conversation.buyerId, otherId), eq(conversation.sellerId, actorId))
      )
    )
    .orderBy(conversation.id)
    .for('update');
  if (!shared.length)
    throw new AppError('NOT_FOUND', 'Conversation participant was not found', 404);
}
