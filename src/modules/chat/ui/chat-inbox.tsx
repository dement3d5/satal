'use client';

import Link from 'next/link';
import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';

interface ConversationItem {
  id: string;
  status: 'open' | 'closed';
  listingId: string;
  listingTitle: string;
  listingStatus: string;
  role: 'buyer' | 'seller';
  otherParticipant: {id: string; name: string};
  lastMessage: {body: string; sentByMe: boolean; createdAt: string} | null;
  unreadCount: number;
  blockedByYou: boolean;
  blockedByOther: boolean;
  canSend: boolean;
}

interface MessageItem {
  id: string;
  sequence: number;
  senderId: string;
  senderName: string;
  body: string;
  sentByMe: boolean;
  createdAt: string;
}

interface ChatLabels {
  loading: string;
  authTitle: string;
  authText: string;
  error: string;
  empty: string;
  listing: string;
  unread: string;
  me: string;
  loadOlder: string;
  placeholder: string;
  send: string;
  sending: string;
  rateLimit: string;
  unavailable: string;
  closedByModeration: string;
  block: string;
  unblock: string;
  blockedByYou: string;
  blockedByOther: string;
  safety: string;
  report: string;
  reportReason: string;
  reportDetails: string;
  reportDetailsHint: string;
  reportSubmit: string;
  reporting: string;
  reportSuccess: string;
  reportRateLimit: string;
  reportError: string;
  reportReasons: Record<string, string>;
}

export function ChatInbox({
  locale,
  initialConversationId,
  labels
}: {
  locale: AppLocale;
  initialConversationId?: string;
  labels: ChatLabels;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId ?? '');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState('');

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(async () => {
    const response = await fetch(`/api/v1/conversations?locale=${locale}`, {cache: 'no-store'});
    if (response.status === 401) {
      setState('auth');
      return [];
    }
    if (!response.ok) throw new Error('conversation list failed');
    const result = (await response.json()) as {data: ConversationItem[]};
    setConversations(result.data);
    setSelectedId((current) =>
      result.data.some((item) => item.id === current) ? current : (result.data[0]?.id ?? '')
    );
    setState('ready');
    return result.data;
  }, [locale]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/v1/conversations/${conversationId}/messages?limit=50`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('message list failed');
    const result = (await response.json()) as {
      data: {items: MessageItem[]; nextBeforeSequence: number | null};
    };
    setMessages(result.data.items);
    setNextBefore(result.data.nextBeforeSequence);
    await fetch(`/api/v1/conversations/${conversationId}/read`, {method: 'POST'});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadConversations().catch(() => setState('error'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId || state !== 'ready') return;
    const timer = window.setTimeout(() => {
      loadMessages(selectedId)
        .then(() => loadConversations())
        .catch(() => setFeedback(labels.error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [labels.error, loadConversations, loadMessages, selectedId, state]);

  useEffect(() => {
    if (!selectedId || state !== 'ready') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(selectedId).catch(() => undefined);
        loadConversations().catch(() => undefined);
      }
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId, state]);

  async function loadOlder() {
    if (!selectedId || !nextBefore) return;
    const response = await fetch(
      `/api/v1/conversations/${selectedId}/messages?limit=50&beforeSequence=${nextBefore}`,
      {cache: 'no-store'}
    );
    if (!response.ok) return setFeedback(labels.error);
    const result = (await response.json()) as {
      data: {items: MessageItem[]; nextBeforeSequence: number | null};
    };
    setMessages((items) => [...result.data.items, ...items]);
    setNextBefore(result.data.nextBeforeSequence);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !body.trim() || sending) return;
    setSending(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/v1/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({clientMessageId: crypto.randomUUID(), body})
      });
      const result = (await response.json()) as {data?: {message: MessageItem}};
      if (response.status === 429) return setFeedback(labels.rateLimit);
      if (response.status === 403 || response.status === 409)
        return setFeedback(labels.unavailable);
      if (!response.ok || !result.data) return setFeedback(labels.error);
      setMessages((items) =>
        items.some((item) => item.id === result.data!.message.id)
          ? items
          : [...items, result.data!.message]
      );
      setBody('');
      await loadConversations();
    } catch {
      setFeedback(labels.error);
    } finally {
      setSending(false);
    }
  }

  async function toggleBlock() {
    if (!selected) return;
    const response = await fetch(`/api/v1/blocks/${selected.otherParticipant.id}`, {
      method: selected.blockedByYou ? 'DELETE' : 'PUT'
    });
    if (!response.ok) return setFeedback(labels.error);
    await loadConversations();
  }

  async function reportMessage(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    if (!selected || reportingMessageId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const details = String(data.get('details') ?? '').trim();
    setReportingMessageId(messageId);
    setFeedback('');
    try {
      const response = await fetch(
        `/api/v1/conversations/${selected.id}/messages/${messageId}/reports`,
        {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            reason: String(data.get('reason') ?? ''),
            ...(details ? {details} : {})
          })
        }
      );
      if (response.status === 429) return setFeedback(labels.reportRateLimit);
      if (!response.ok) return setFeedback(labels.reportError);
      setReportedMessageIds((current) => new Set(current).add(messageId));
      setFeedback(labels.reportSuccess);
      form.reset();
    } catch {
      setFeedback(labels.reportError);
    } finally {
      setReportingMessageId(null);
    }
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
  if (!conversations.length)
    return (
      <div className="listing-empty">
        <strong>{labels.empty}</strong>
      </div>
    );

  return (
    <div className="chat-layout">
      <aside className="conversation-list" aria-label={labels.listing}>
        {conversations.map((item) => (
          <button
            className={item.id === selectedId ? 'is-active' : undefined}
            type="button"
            key={item.id}
            onClick={() => {
              setSelectedId(item.id);
              setReportedMessageIds(new Set());
              setFeedback('');
            }}
          >
            <span>
              <strong>{item.otherParticipant.name}</strong>
              {item.unreadCount > 0 && (
                <small className="unread-badge">
                  {labels.unread}: {item.unreadCount}
                </small>
              )}
            </span>
            <small>{item.listingTitle}</small>
            <p>
              {item.lastMessage?.sentByMe ? `${labels.me}: ` : ''}
              {item.lastMessage?.body ?? ''}
            </p>
          </button>
        ))}
      </aside>

      {selected && (
        <section className="message-panel">
          <header>
            <div>
              <strong>{selected.otherParticipant.name}</strong>
              <Link href={`/${locale}/listings/${selected.listingId}`}>
                {labels.listing}: {selected.listingTitle}
              </Link>
            </div>
            <button className="button button-quiet" type="button" onClick={toggleBlock}>
              {selected.blockedByYou ? labels.unblock : labels.block}
            </button>
          </header>
          {nextBefore && (
            <button className="message-load-older" type="button" onClick={loadOlder}>
              {labels.loadOlder}
            </button>
          )}
          <div className="message-stream" aria-live="polite">
            {messages.map((item) => (
              <article
                className={item.sentByMe ? 'message-bubble is-mine' : 'message-bubble'}
                key={item.id}
              >
                <strong>{item.sentByMe ? labels.me : item.senderName}</strong>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short'}).format(
                    new Date(item.createdAt)
                  )}
                </time>
                {!item.sentByMe && selected.status === 'open' && (
                  <details className="message-report">
                    <summary>
                      {reportedMessageIds.has(item.id) ? labels.reportSuccess : labels.report}
                    </summary>
                    {!reportedMessageIds.has(item.id) && (
                      <form onSubmit={(event) => void reportMessage(event, item.id)}>
                        <label>
                          {labels.reportReason}
                          <select name="reason" defaultValue="spam" required>
                            {Object.entries(labels.reportReasons).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {labels.reportDetails}
                          <textarea
                            name="details"
                            minLength={10}
                            maxLength={1000}
                            placeholder={labels.reportDetailsHint}
                          />
                        </label>
                        <button
                          className="button button-quiet"
                          type="submit"
                          disabled={reportingMessageId !== null}
                        >
                          {reportingMessageId === item.id ? labels.reporting : labels.reportSubmit}
                        </button>
                      </form>
                    )}
                  </details>
                )}
              </article>
            ))}
          </div>
          {selected.status === 'closed' && (
            <p className="chat-state-note">{labels.closedByModeration}</p>
          )}
          {selected.status === 'open' && selected.blockedByYou && (
            <p className="chat-state-note">{labels.blockedByYou}</p>
          )}
          {selected.status === 'open' && selected.blockedByOther && (
            <p className="chat-state-note">{labels.blockedByOther}</p>
          )}
          {selected.status === 'open' &&
            !selected.blockedByYou &&
            !selected.blockedByOther &&
            !selected.canSend && <p className="chat-state-note">{labels.unavailable}</p>}
          <form className="message-composer" onSubmit={send}>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={labels.placeholder}
              maxLength={2000}
              disabled={!selected.canSend || sending}
              required
            />
            <div>
              <small>{labels.safety}</small>
              <button
                className="button button-primary"
                type="submit"
                disabled={!selected.canSend || sending}
              >
                {sending ? labels.sending : labels.send}
              </button>
            </div>
          </form>
          {feedback && <p aria-live="polite">{feedback}</p>}
        </section>
      )}
    </div>
  );
}
