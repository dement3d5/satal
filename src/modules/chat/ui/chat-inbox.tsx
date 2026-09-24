'use client';

import Link from 'next/link';
import {FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';

import {
  getMessageSoundEnabled,
  primeMessageSound,
  publishUnreadMessageCount,
  setMessageSoundEnabled
} from './message-alerts';

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
  canQualify: boolean;
  interaction: {
    id: string;
    qualifiedAt: string;
    review: {
      id: string;
      rating: number;
      body: string | null;
      revealAt: string;
      visible: boolean;
    } | null;
  } | null;
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
  inboxTitle: string;
  conversationCount: string;
  searchPlaceholder: string;
  allConversations: string;
  unreadOnly: string;
  noSearchResults: string;
  notificationSettings: string;
  sound: string;
  soundOn: string;
  soundOff: string;
  browserNotifications: string;
  enableBrowserNotifications: string;
  notificationsEnabled: string;
  notificationsDenied: string;
  notificationsUnsupported: string;
  backToConversations: string;
  conversationActions: string;
  openConversation: string;
  closedConversation: string;
  buyer: string;
  seller: string;
  characters: string;
  sendHint: string;
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
  qualificationAction: string;
  qualificationTitle: string;
  qualificationExplanation: string;
  qualificationConfirm: string;
  qualifying: string;
  qualificationSuccess: string;
  qualificationUnavailable: string;
  reviewTitle: string;
  reviewExplanation: string;
  reviewRating: string;
  reviewBody: string;
  reviewBodyHint: string;
  reviewSubmit: string;
  reviewing: string;
  reviewSaved: string;
  reviewPending: string;
  reviewVisible: string;
  reviewConflict: string;
  reviewError: string;
}

type NotificationPermissionState = NotificationPermission | 'unsupported';

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
  const [query, setQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(initialConversationId));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('default');
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState('');
  const messageStreamRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const totalUnread = useMemo(
    () => conversations.reduce((total, item) => total + item.unreadCount, 0),
    [conversations]
  );
  const visibleConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return conversations.filter((item) => {
      if (listFilter === 'unread' && item.unreadCount === 0) return false;
      if (!normalizedQuery) return true;
      return [item.otherParticipant.name, item.listingTitle, item.lastMessage?.body ?? ''].some(
        (value) => value.toLocaleLowerCase(locale).includes(normalizedQuery)
      );
    });
  }, [conversations, listFilter, locale, query]);
  const lastMessageId = messages.at(-1)?.id;

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
    publishUnreadMessageCount(result.data.reduce((total, item) => total + item.unreadCount, 0));
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
    const readResponse = await fetch(`/api/v1/conversations/${conversationId}/read`, {
      method: 'POST'
    });
    if (!readResponse.ok) throw new Error('conversation read failed');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSoundEnabled(getMessageSoundEnabled());
      setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadConversations().catch(() => setState('error'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId || state !== 'ready') return;
    if (window.matchMedia('(max-width: 48rem)').matches && !mobileThreadOpen) return;
    const timer = window.setTimeout(() => {
      loadMessages(selectedId)
        .then(() => loadConversations())
        .catch(() => setFeedback(labels.error));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [labels.error, loadConversations, loadMessages, mobileThreadOpen, selectedId, state]);

  useEffect(() => {
    if (!selectedId || state !== 'ready') return;
    if (window.matchMedia('(max-width: 48rem)').matches && !mobileThreadOpen) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(selectedId)
          .then(() => loadConversations())
          .catch(() => undefined);
      }
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, mobileThreadOpen, selectedId, state]);

  useEffect(() => {
    const stream = messageStreamRef.current;
    if (!stream || !lastMessageId) return;
    stream.scrollTo({top: stream.scrollHeight, behavior: 'smooth'});
  }, [lastMessageId, selectedId]);

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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
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

  async function qualifyInteraction() {
    if (!selected || !selected.canQualify || qualifying) return;
    setQualifying(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/v1/conversations/${selected.id}/interaction`, {
        method: 'POST'
      });
      if (response.status === 403 || response.status === 409)
        return setFeedback(labels.qualificationUnavailable);
      if (!response.ok) return setFeedback(labels.error);
      await loadConversations();
      setFeedback(labels.qualificationSuccess);
    } catch {
      setFeedback(labels.error);
    } finally {
      setQualifying(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interaction || selected.interaction.review || reviewing) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const reviewBody = String(data.get('body') ?? '').trim();
    setReviewing(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/v1/interactions/${selected.interaction.id}/reviews`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          rating: Number(data.get('rating')),
          ...(reviewBody ? {body: reviewBody} : {})
        })
      });
      if (response.status === 409) return setFeedback(labels.reviewConflict);
      if (!response.ok) return setFeedback(labels.reviewError);
      await loadConversations();
      setFeedback(labels.reviewSaved);
      form.reset();
    } catch {
      setFeedback(labels.reviewError);
    } finally {
      setReviewing(false);
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setMessageSoundEnabled(next);
    if (next) primeMessageSound();
  }

  async function requestBrowserNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  if (state === 'loading')
    return (
      <div className="chat-loading" aria-live="polite">
        <span aria-hidden="true" />
        <strong>{labels.loading}</strong>
      </div>
    );
  if (state === 'auth')
    return (
      <div className="listing-empty chat-empty-state">
        <MessageOutlineIcon />
        <strong>{labels.authTitle}</strong>
        <span>{labels.authText}</span>
      </div>
    );
  if (state === 'error')
    return (
      <div className="listing-empty chat-empty-state">
        <MessageOutlineIcon />
        <strong>{labels.error}</strong>
      </div>
    );
  if (!conversations.length)
    return (
      <div className="listing-empty chat-empty-state">
        <MessageOutlineIcon />
        <strong>{labels.empty}</strong>
      </div>
    );

  return (
    <div className={`chat-layout${mobileThreadOpen ? ' is-thread-open' : ''}`}>
      <aside className="conversation-sidebar" aria-label={labels.inboxTitle}>
        <header className="conversation-sidebar-header">
          <div>
            <h2>{labels.inboxTitle}</h2>
            <span>
              {labels.conversationCount}: {conversations.length}
            </span>
          </div>
          <details className="chat-alert-settings">
            <summary aria-label={labels.notificationSettings} title={labels.notificationSettings}>
              <BellIcon />
              {totalUnread > 0 && <span aria-hidden="true" />}
            </summary>
            <div>
              <strong>{labels.notificationSettings}</strong>
              <button className="chat-setting-row" type="button" onClick={toggleSound}>
                <span>
                  <SoundIcon />
                  <span>
                    <strong>{labels.sound}</strong>
                    <small>{soundEnabled ? labels.soundOn : labels.soundOff}</small>
                  </span>
                </span>
                <span className={`chat-toggle${soundEnabled ? ' is-on' : ''}`} aria-hidden="true" />
              </button>
              <div className="chat-setting-row">
                <span>
                  <DesktopNotificationIcon />
                  <span>
                    <strong>{labels.browserNotifications}</strong>
                    <small>
                      {notificationPermission === 'granted'
                        ? labels.notificationsEnabled
                        : notificationPermission === 'denied'
                          ? labels.notificationsDenied
                          : notificationPermission === 'unsupported'
                            ? labels.notificationsUnsupported
                            : labels.enableBrowserNotifications}
                    </small>
                  </span>
                </span>
                {notificationPermission === 'default' && (
                  <button type="button" onClick={() => void requestBrowserNotifications()}>
                    {labels.enableBrowserNotifications}
                  </button>
                )}
              </div>
            </div>
          </details>
        </header>

        <label className="conversation-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            type="search"
          />
        </label>

        <div className="conversation-filters" aria-label={labels.inboxTitle}>
          <button
            type="button"
            className={listFilter === 'all' ? 'is-active' : undefined}
            aria-pressed={listFilter === 'all'}
            onClick={() => setListFilter('all')}
          >
            {labels.allConversations}
          </button>
          <button
            type="button"
            className={listFilter === 'unread' ? 'is-active' : undefined}
            aria-pressed={listFilter === 'unread'}
            onClick={() => setListFilter('unread')}
          >
            {labels.unreadOnly}
            {totalUnread > 0 && <span>{formatBadgeCount(totalUnread)}</span>}
          </button>
        </div>

        <div className="conversation-list">
          {visibleConversations.length ? (
            visibleConversations.map((item) => (
              <button
                className={`${item.id === selectedId ? 'is-active' : ''}${item.unreadCount > 0 ? ' is-unread' : ''}`}
                type="button"
                key={item.id}
                aria-current={item.id === selectedId ? 'true' : undefined}
                onClick={() => {
                  setSelectedId(item.id);
                  setMobileThreadOpen(true);
                  setReportedMessageIds(new Set());
                  setFeedback('');
                }}
              >
                <span className="conversation-avatar" aria-hidden="true">
                  {initialsFor(item.otherParticipant.name, locale)}
                </span>
                <span className="conversation-copy">
                  <span className="conversation-name-row">
                    <strong>{item.otherParticipant.name}</strong>
                    {item.lastMessage && (
                      <time dateTime={item.lastMessage.createdAt}>
                        {formatConversationTime(item.lastMessage.createdAt, locale)}
                      </time>
                    )}
                  </span>
                  <span className="conversation-listing-row">
                    <small>{item.role === 'buyer' ? labels.seller : labels.buyer}</small>
                    <span aria-hidden="true">·</span>
                    <small>{item.listingTitle}</small>
                  </span>
                  <span className="conversation-preview-row">
                    <p>
                      {item.lastMessage?.sentByMe ? `${labels.me}: ` : ''}
                      {item.lastMessage?.body ?? ''}
                    </p>
                    {item.unreadCount > 0 && (
                      <span
                        className="unread-badge"
                        aria-label={`${labels.unread}: ${item.unreadCount}`}
                      >
                        {formatBadgeCount(item.unreadCount)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="conversation-no-results">{labels.noSearchResults}</p>
          )}
        </div>
      </aside>

      {selected && (
        <section className="message-panel">
          <header className="message-panel-header">
            <button
              className="message-back-button"
              type="button"
              aria-label={labels.backToConversations}
              title={labels.backToConversations}
              onClick={() => setMobileThreadOpen(false)}
            >
              <BackIcon />
            </button>
            <span className="conversation-avatar is-large" aria-hidden="true">
              {initialsFor(selected.otherParticipant.name, locale)}
            </span>
            <div className="message-participant">
              <span>
                <strong>{selected.otherParticipant.name}</strong>
                <small className={`conversation-status is-${selected.status}`}>
                  {selected.status === 'open' ? labels.openConversation : labels.closedConversation}
                </small>
              </span>
              {selected.listingStatus === 'active' ? (
                <Link href={`/${locale}/listings/${selected.listingId}`}>
                  {labels.listing}: {selected.listingTitle}
                </Link>
              ) : (
                <span>
                  {labels.listing}: {selected.listingTitle}
                </span>
              )}
            </div>
            <details className="conversation-actions">
              <summary aria-label={labels.conversationActions} title={labels.conversationActions}>
                <MoreIcon />
              </summary>
              <div>
                <button type="button" onClick={() => void toggleBlock()}>
                  {selected.blockedByYou ? labels.unblock : labels.block}
                </button>
              </div>
            </details>
          </header>

          <div className="message-thread">
            {nextBefore && (
              <button className="message-load-older" type="button" onClick={loadOlder}>
                {labels.loadOlder}
              </button>
            )}
            <div className="message-stream" aria-live="polite" ref={messageStreamRef}>
              {messages.map((item) => (
                <article
                  className={item.sentByMe ? 'message-bubble is-mine' : 'message-bubble'}
                  key={item.id}
                >
                  {!item.sentByMe && <strong>{item.senderName}</strong>}
                  <p>{item.body}</p>
                  <footer>
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat(locale, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(new Date(item.createdAt))}
                    </time>
                    {item.sentByMe && <MessageDeliveredIcon />}
                  </footer>
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
                            {reportingMessageId === item.id
                              ? labels.reporting
                              : labels.reportSubmit}
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
            {selected.canQualify && (
              <details className="interaction-card">
                <summary>{labels.qualificationAction}</summary>
                <h3>{labels.qualificationTitle}</h3>
                <p>{labels.qualificationExplanation}</p>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={qualifying}
                  onClick={() => void qualifyInteraction()}
                >
                  {qualifying ? labels.qualifying : labels.qualificationConfirm}
                </button>
              </details>
            )}
            {selected.interaction && (
              <section className="interaction-card" aria-labelledby="interaction-review-title">
                <h3 id="interaction-review-title">{labels.reviewTitle}</h3>
                <p>{labels.reviewExplanation}</p>
                {selected.interaction.review ? (
                  <div className="review-result">
                    <strong aria-label={`${selected.interaction.review.rating}/5`}>
                      {'★'.repeat(selected.interaction.review.rating)}
                      {'☆'.repeat(5 - selected.interaction.review.rating)}
                    </strong>
                    <span>
                      {selected.interaction.review.visible
                        ? labels.reviewVisible
                        : labels.reviewPending}
                    </span>
                  </div>
                ) : (
                  <form onSubmit={(event) => void submitReview(event)}>
                    <label>
                      {labels.reviewRating}
                      <select name="rating" defaultValue="5" required>
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating} / 5
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {labels.reviewBody}
                      <textarea
                        name="body"
                        minLength={10}
                        maxLength={1000}
                        placeholder={labels.reviewBodyHint}
                      />
                    </label>
                    <button className="button" type="submit" disabled={reviewing}>
                      {reviewing ? labels.reviewing : labels.reviewSubmit}
                    </button>
                  </form>
                )}
              </section>
            )}
          </div>

          {feedback && (
            <p className="chat-feedback" aria-live="polite">
              {feedback}
            </p>
          )}
          <form className="message-composer" onSubmit={send}>
            <div className="message-composer-field">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={labels.placeholder}
                maxLength={2000}
                rows={1}
                disabled={!selected.canSend || sending}
                required
              />
              <span>
                {labels.characters}: {body.length}/2000
              </span>
            </div>
            <button
              className="message-send-button"
              type="submit"
              aria-label={sending ? labels.sending : labels.send}
              title={sending ? labels.sending : labels.send}
              disabled={!selected.canSend || sending || !body.trim()}
            >
              <SendIcon />
            </button>
            <small className="message-composer-hint">{labels.sendHint}</small>
            <small className="message-safety-note">
              <ShieldIcon /> {labels.safety}
            </small>
          </form>
        </section>
      )}
    </div>
  );
}

function initialsFor(name: string, locale: AppLocale) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase(locale))
      .join('') || 'S'
  );
}

function formatConversationTime(value: string, locale: AppLocale) {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return new Intl.DateTimeFormat(
    locale,
    sameDay ? {hour: '2-digit', minute: '2-digit'} : {day: '2-digit', month: 'short'}
  ).format(date);
}

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

function MessageOutlineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32">
      <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path d="M6 9.5a6 6 0 0 1 12 0c0 6 2.2 6.4 2.2 7.5H3.8C3.8 15.9 6 15.5 6 9.5ZM9.5 20h5" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path d="M5 10v4h3l4 3V7l-4 3H5ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

function DesktopNotificationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path d="m12.5 4-6 6 6 6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <circle cx="4" cy="10" r="1" />
      <circle cx="10" cy="10" r="1" />
      <circle cx="16" cy="10" r="1" />
    </svg>
  );
}

function MessageDeliveredIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 12" width="16" height="12">
      <path d="m1 6 3 3 5-6M7 7l2 2 7-7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21">
      <path d="m3 4 18 8-18 8 3-8-3-8Zm3 8h15" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15">
      <path d="M10 2 17 5v5c0 4-2.5 6.5-7 8-4.5-1.5-7-4-7-8V5l7-3Z" />
      <path d="m7 10 2 2 4-4" />
    </svg>
  );
}
