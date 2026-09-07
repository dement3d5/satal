'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface NotificationItem {
  id: string;
  type: 'chat_message';
  actorName: string;
  listingTitle: string;
  conversationId: string;
  messagePreview: string;
  readAt: string | null;
  createdAt: string;
}

interface PreferenceState {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  capabilities: {inApp: boolean; email: boolean; push: boolean};
}

interface NotificationLabels {
  loading: string;
  authTitle: string;
  authText: string;
  error: string;
  empty: string;
  unreadCount: string;
  chatMessage: string;
  openConversation: string;
  markRead: string;
  preferencesTitle: string;
  inApp: string;
  email: string;
  push: string;
  externalUnavailable: string;
  preferenceError: string;
}

export function NotificationCenter({
  locale,
  labels
}: {
  locale: AppLocale;
  labels: NotificationLabels;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceState | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/notifications', {cache: 'no-store'}),
      fetch('/api/v1/notification-preferences', {cache: 'no-store'})
    ])
      .then(async ([notificationResponse, preferenceResponse]) => {
        if (notificationResponse.status === 401 || preferenceResponse.status === 401) return null;
        if (!notificationResponse.ok || !preferenceResponse.ok)
          throw new Error('notification load failed');
        return {
          notifications: (await notificationResponse.json()) as {
            data: {items: NotificationItem[]; unreadCount: number};
          },
          preferences: (await preferenceResponse.json()) as {data: PreferenceState}
        };
      })
      .then((result) => {
        if (!result) return setState('auth');
        setItems(result.notifications.data.items);
        setUnreadCount(result.notifications.data.unreadCount);
        setPreferences(result.preferences.data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const response = await fetch(`/api/v1/notifications/${item.id}`, {
      method: 'PATCH',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({read: true})
    });
    if (!response.ok) return setFeedback(labels.error);
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((candidate) => (candidate.id === item.id ? {...candidate, readAt} : candidate))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function toggleInApp() {
    if (!preferences) return;
    setFeedback('');
    const response = await fetch('/api/v1/notification-preferences', {
      method: 'PATCH',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({inAppEnabled: !preferences.inAppEnabled})
    });
    if (!response.ok) return setFeedback(labels.preferenceError);
    const result = (await response.json()) as {data: PreferenceState};
    setPreferences(result.data);
  }

  if (state === 'loading') return <p>{labels.loading}</p>;
  if (state === 'auth')
    return (
      <div className="listing-empty">
        <strong>{labels.authTitle}</strong>
        <span>{labels.authText}</span>
      </div>
    );
  if (state === 'error')
    return (
      <div className="listing-empty">
        <strong>{labels.error}</strong>
      </div>
    );

  return (
    <div className="notification-layout">
      <section className="notification-list">
        <h2>
          {labels.unreadCount}: {unreadCount}
        </h2>
        {items.length ? (
          items.map((item) => (
            <article className={item.readAt ? 'is-read' : undefined} key={item.id}>
              <div>
                <strong>
                  {labels.chatMessage} {item.actorName}
                </strong>
                <small>{item.listingTitle}</small>
                <p>{item.messagePreview}</p>
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(item.createdAt))}
                </time>
              </div>
              <div className="notification-actions">
                {!item.readAt && (
                  <button type="button" onClick={() => markRead(item)}>
                    {labels.markRead}
                  </button>
                )}
                <Link
                  className="button button-secondary"
                  href={`/${locale}/messages?conversation=${item.conversationId}`}
                  onClick={() => markRead(item)}
                >
                  {labels.openConversation}
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p>{labels.empty}</p>
        )}
      </section>

      {preferences && (
        <aside className="notification-preferences">
          <h2>{labels.preferencesTitle}</h2>
          <label>
            <input type="checkbox" checked={preferences.inAppEnabled} onChange={toggleInApp} />
            {labels.inApp}
          </label>
          <label className="is-disabled">
            <input type="checkbox" checked={preferences.emailEnabled} disabled />
            {labels.email}
          </label>
          <label className="is-disabled">
            <input type="checkbox" checked={preferences.pushEnabled} disabled />
            {labels.push}
          </label>
          <p>{labels.externalUnavailable}</p>
          {feedback && <p aria-live="polite">{feedback}</p>}
        </aside>
      )}
    </div>
  );
}
