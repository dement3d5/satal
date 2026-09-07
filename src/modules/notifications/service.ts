import {and, count, desc, eq, isNull} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  conversationMessage,
  listing,
  notification,
  notificationPreference,
  user
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {NotificationListQuery, UpdateNotificationPreferencesInput} from './contracts';

const defaultPreferences = {
  type: 'chat_message' as const,
  inAppEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
  capabilities: {inApp: true, email: false, push: false}
};

export async function listNotifications(
  db: DatabaseClient,
  actorId: string,
  query: NotificationListQuery
) {
  const where = and(
    eq(notification.recipientId, actorId),
    query.unreadOnly ? isNull(notification.readAt) : undefined
  );
  const [totalUnreadRows, rows] = await Promise.all([
    db
      .select({value: count()})
      .from(notification)
      .where(and(eq(notification.recipientId, actorId), isNull(notification.readAt))),
    db
      .select({
        id: notification.id,
        type: notification.type,
        actorId: notification.actorId,
        actorName: user.name,
        listingId: notification.listingId,
        listingTitle: listing.title,
        conversationId: notification.conversationId,
        messagePreview: conversationMessage.body,
        readAt: notification.readAt,
        createdAt: notification.createdAt
      })
      .from(notification)
      .innerJoin(user, eq(user.id, notification.actorId))
      .innerJoin(listing, eq(listing.id, notification.listingId))
      .innerJoin(conversationMessage, eq(conversationMessage.id, notification.messageId))
      .where(where)
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(query.limit)
  ]);
  return {
    unreadCount: totalUnreadRows[0]?.value ?? 0,
    items: rows.map((row) => ({
      ...row,
      messagePreview: row.messagePreview.slice(0, 160),
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    }))
  };
}

export async function markNotificationRead(
  db: DatabaseClient,
  actorId: string,
  notificationId: string
) {
  const [updated] = await db
    .update(notification)
    .set({readAt: new Date()})
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.recipientId, actorId),
        isNull(notification.readAt)
      )
    )
    .returning({id: notification.id, readAt: notification.readAt});
  if (updated) return {id: updated.id, readAt: updated.readAt?.toISOString() ?? null};
  const [existing] = await db
    .select({id: notification.id, readAt: notification.readAt})
    .from(notification)
    .where(and(eq(notification.id, notificationId), eq(notification.recipientId, actorId)))
    .limit(1);
  if (!existing) throw new AppError('NOT_FOUND', 'Notification was not found', 404);
  return {id: existing.id, readAt: existing.readAt?.toISOString() ?? null};
}

export async function getNotificationPreferences(db: DatabaseClient, actorId: string) {
  const [row] = await db
    .select({
      type: notificationPreference.type,
      inAppEnabled: notificationPreference.inAppEnabled,
      emailEnabled: notificationPreference.emailEnabled,
      pushEnabled: notificationPreference.pushEnabled
    })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.userId, actorId),
        eq(notificationPreference.type, 'chat_message')
      )
    )
    .limit(1);
  return row ? {...row, capabilities: defaultPreferences.capabilities} : defaultPreferences;
}

export async function updateNotificationPreferences(
  db: DatabaseClient,
  actorId: string,
  input: UpdateNotificationPreferencesInput
) {
  if (input.emailEnabled === true || input.pushEnabled === true)
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'External notification delivery is not configured',
      503
    );
  const current = await getNotificationPreferences(db, actorId);
  const values = {
    inAppEnabled: input.inAppEnabled ?? current.inAppEnabled,
    emailEnabled: input.emailEnabled ?? current.emailEnabled,
    pushEnabled: input.pushEnabled ?? current.pushEnabled,
    updatedAt: new Date()
  };
  const [row] = await db
    .insert(notificationPreference)
    .values({userId: actorId, type: 'chat_message', ...values})
    .onConflictDoUpdate({
      target: [notificationPreference.userId, notificationPreference.type],
      set: values
    })
    .returning({
      type: notificationPreference.type,
      inAppEnabled: notificationPreference.inAppEnabled,
      emailEnabled: notificationPreference.emailEnabled,
      pushEnabled: notificationPreference.pushEnabled
    });
  if (!row) throw new AppError('UNEXPECTED_ERROR', 'Preferences were not saved', 500);
  return {...row, capabilities: defaultPreferences.capabilities};
}
