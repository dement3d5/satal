import {and, asc, count, eq, gte, inArray, ne, or} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  conversation,
  conversationMessage,
  listing,
  messageReport,
  messageReportAction,
  outboxEvent,
  user
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {
  CreateMessageReportInput,
  MessageReportDecisionInput
} from './message-report-contracts';
import {
  assertMessageReportAccess,
  assertOpenMessageReport,
  assertReportableMessage
} from './message-report-domain';
import {requireModerationCapability} from './service';
import type {TrustQueueQuery} from './trust-contracts';

const MESSAGE_REPORT_LIMIT_PER_HOUR = 10;

export async function getOwnMessageReport(
  db: DatabaseClient,
  actorId: string,
  conversationId: string,
  messageId: string
) {
  const target = await loadReportableMessage(db, actorId, conversationId, messageId);
  if (!target) throw new AppError('NOT_FOUND', 'Message was not found', 404);
  assertMessageReportAccess({...target, actorId});
  const [report] = await db
    .select({
      id: messageReport.id,
      reason: messageReport.reason,
      status: messageReport.status,
      createdAt: messageReport.createdAt
    })
    .from(messageReport)
    .where(and(eq(messageReport.reporterId, actorId), eq(messageReport.messageId, messageId)))
    .limit(1);
  return report
    ? {
        ...report,
        conversationId,
        messageId,
        reported: true as const,
        createdAt: report.createdAt.toISOString()
      }
    : {conversationId, messageId, reported: false as const};
}

export async function createMessageReport(
  db: DatabaseClient,
  actorId: string,
  conversationId: string,
  messageId: string,
  input: CreateMessageReportInput
) {
  return db.transaction(async (transaction) => {
    const [actor] = await transaction
      .select({id: user.id})
      .from(user)
      .where(eq(user.id, actorId))
      .for('update')
      .limit(1);
    if (!actor) throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);

    const target = await loadReportableMessage(
      transaction,
      actorId,
      conversationId,
      messageId,
      true
    );
    if (!target) throw new AppError('NOT_FOUND', 'Message was not found', 404);
    assertMessageReportAccess({...target, actorId});

    const [existing] = await transaction
      .select({
        id: messageReport.id,
        reason: messageReport.reason,
        status: messageReport.status,
        createdAt: messageReport.createdAt
      })
      .from(messageReport)
      .where(and(eq(messageReport.reporterId, actorId), eq(messageReport.messageId, messageId)))
      .limit(1);
    if (existing) {
      return {
        ...existing,
        conversationId,
        messageId,
        created: false as const,
        createdAt: existing.createdAt.toISOString()
      };
    }

    assertReportableMessage({...target, actorId});
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await transaction
      .select({value: count()})
      .from(messageReport)
      .where(and(eq(messageReport.reporterId, actorId), gte(messageReport.createdAt, since)));
    if ((recent?.value ?? 0) >= MESSAGE_REPORT_LIMIT_PER_HOUR) {
      throw new AppError('RATE_LIMITED', 'Message report limit reached', 429);
    }

    const [created] = await transaction
      .insert(messageReport)
      .values({
        messageId,
        reporterId: actorId,
        reason: input.reason,
        details: input.details
      })
      .returning({
        id: messageReport.id,
        reason: messageReport.reason,
        status: messageReport.status,
        createdAt: messageReport.createdAt
      });
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Message report was not created', 500);
    await transaction.insert(outboxEvent).values({
      aggregateType: 'message_report',
      aggregateId: created.id,
      eventType: 'chat.message_reported',
      aggregateVersion: 1,
      payload: {reportId: created.id, conversationId, messageId}
    });
    return {
      ...created,
      conversationId,
      messageId,
      created: true as const,
      createdAt: created.createdAt.toISOString()
    };
  });
}

export async function listModerationMessageReports(
  db: DatabaseClient,
  actorId: string,
  query: TrustQueueQuery
) {
  await requireModerationCapability(db, actorId, 'message-reports:read');
  const rows = await db
    .select({
      reportId: messageReport.id,
      messageId: conversationMessage.id,
      conversationId: conversation.id,
      listingId: listing.id,
      listingTitle: listing.title,
      messageBody: conversationMessage.body,
      senderName: user.name,
      reason: messageReport.reason,
      details: messageReport.details,
      createdAt: messageReport.createdAt
    })
    .from(messageReport)
    .innerJoin(conversationMessage, eq(conversationMessage.id, messageReport.messageId))
    .innerJoin(conversation, eq(conversation.id, conversationMessage.conversationId))
    .innerJoin(listing, eq(listing.id, conversation.listingId))
    .innerJoin(user, eq(user.id, conversationMessage.senderId))
    .where(
      and(
        eq(messageReport.status, 'open'),
        eq(conversation.status, 'open'),
        ne(conversation.buyerId, actorId),
        ne(conversation.sellerId, actorId)
      )
    )
    .orderBy(asc(messageReport.createdAt), asc(messageReport.id))
    .limit(query.limit);
  return rows.map((row) => ({...row, createdAt: row.createdAt.toISOString()}));
}

export async function decideMessageReport(
  db: DatabaseClient,
  actorId: string,
  reportId: string,
  input: MessageReportDecisionInput
) {
  return db.transaction(async (transaction) => {
    await requireModerationCapability(transaction, actorId, 'message-reports:decide');
    const [reference] = await transaction
      .select({conversationId: conversationMessage.conversationId})
      .from(messageReport)
      .innerJoin(conversationMessage, eq(conversationMessage.id, messageReport.messageId))
      .where(eq(messageReport.id, reportId))
      .limit(1);
    if (!reference) throw new AppError('NOT_FOUND', 'Message report was not found', 404);

    const [thread] = await transaction
      .select({
        id: conversation.id,
        status: conversation.status,
        buyerId: conversation.buyerId,
        sellerId: conversation.sellerId
      })
      .from(conversation)
      .where(eq(conversation.id, reference.conversationId))
      .for('update')
      .limit(1);
    if (!thread) throw new AppError('NOT_FOUND', 'Message report was not found', 404);
    const [report] = await transaction
      .select({
        id: messageReport.id,
        status: messageReport.status,
        reporterId: messageReport.reporterId,
        messageId: messageReport.messageId
      })
      .from(messageReport)
      .where(eq(messageReport.id, reportId))
      .for('update')
      .limit(1);
    if (!report) throw new AppError('NOT_FOUND', 'Message report was not found', 404);
    assertOpenMessageReport({
      reportStatus: report.status,
      conversationStatus: thread.status,
      reviewerId: actorId,
      reporterId: report.reporterId,
      buyerId: thread.buyerId,
      sellerId: thread.sellerId
    });

    const now = new Date();
    if (input.action === 'dismiss') {
      await transaction
        .update(messageReport)
        .set({status: 'dismissed', resolvedAt: now, updatedAt: now})
        .where(eq(messageReport.id, reportId));
      await transaction.insert(messageReportAction).values({
        reportId,
        actorId,
        action: 'dismiss',
        internalNote: input.internalNote
      });
      return {
        reportId,
        messageId: report.messageId,
        conversationId: thread.id,
        reportStatus: 'dismissed' as const,
        conversationStatus: thread.status
      };
    }

    const openReports = await transaction
      .select({id: messageReport.id})
      .from(messageReport)
      .innerJoin(conversationMessage, eq(conversationMessage.id, messageReport.messageId))
      .where(
        and(eq(conversationMessage.conversationId, thread.id), eq(messageReport.status, 'open'))
      )
      .orderBy(messageReport.id)
      .for('update', {of: messageReport});
    const reportIds = openReports.map((item) => item.id);
    const [closed] = await transaction
      .update(conversation)
      .set({status: 'closed', updatedAt: now})
      .where(and(eq(conversation.id, thread.id), eq(conversation.status, 'open')))
      .returning({id: conversation.id});
    if (!closed) throw new AppError('CONFLICT', 'Conversation changed during review', 409);
    await transaction
      .update(messageReport)
      .set({status: 'resolved', resolvedAt: now, updatedAt: now})
      .where(inArray(messageReport.id, reportIds));
    await transaction.insert(messageReportAction).values(
      reportIds.map((id) => ({
        reportId: id,
        actorId,
        action: 'close_conversation' as const,
        internalNote: id === reportId ? input.internalNote : undefined
      }))
    );
    await transaction.insert(outboxEvent).values({
      aggregateType: 'conversation',
      aggregateId: thread.id,
      eventType: 'chat.conversation_closed',
      aggregateVersion: 1,
      payload: {conversationId: thread.id, reportId, reasonCode: 'message_report_confirmed'}
    });
    return {
      reportId,
      messageId: report.messageId,
      conversationId: thread.id,
      reportStatus: 'resolved' as const,
      conversationStatus: 'closed' as const
    };
  });
}

type MessageReadDatabase = Pick<DatabaseClient, 'select'>;

async function loadReportableMessage(
  db: MessageReadDatabase,
  actorId: string,
  conversationId: string,
  messageId: string,
  lock = false
) {
  const query = db
    .select({
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      senderId: conversationMessage.senderId,
      conversationStatus: conversation.status
    })
    .from(conversationMessage)
    .innerJoin(conversation, eq(conversation.id, conversationMessage.conversationId))
    .where(
      and(
        eq(conversationMessage.id, messageId),
        eq(conversationMessage.conversationId, conversationId),
        or(eq(conversation.buyerId, actorId), eq(conversation.sellerId, actorId))
      )
    )
    .limit(1);
  const [target] = await (lock ? query.for('update', {of: conversation}) : query);
  return target ?? null;
}
