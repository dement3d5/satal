'use client';

import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';

import type {AppLocale} from '@/i18n/routing';
import {
  playMessageSound,
  primeMessageSound,
  UNREAD_MESSAGES_EVENT
} from '@/modules/chat/ui/message-alerts';
import {authClient} from '@/modules/identity/auth-client';

interface HeaderIdentityLabels {
  messages: string;
  saved: string;
  notifications: string;
  account: string;
  signIn: string;
  personalNavigation: string;
  unreadMessages: string;
  newMessageTitle: string;
  newMessageBody: string;
}

export function HeaderIdentityActions({
  locale,
  labels
}: {
  locale: AppLocale;
  labels: HeaderIdentityLabels;
}) {
  const session = authClient.useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCount = useRef<number | null>(null);

  const applyUnreadCount = useCallback(
    (nextCount: number, alert: boolean) => {
      const safeCount = Math.max(0, nextCount);
      const previous = previousUnreadCount.current;
      previousUnreadCount.current = safeCount;
      setUnreadCount(safeCount);

      if (!alert || previous === null || safeCount <= previous) return;
      playMessageSound();
      if (
        document.visibilityState !== 'visible' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification(labels.newMessageTitle, {
          body: labels.newMessageBody,
          tag: 'satal-new-message'
        });
      }
    },
    [labels.newMessageBody, labels.newMessageTitle]
  );

  useEffect(() => {
    if (!session.data) {
      previousUnreadCount.current = null;
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/v1/conversations/unread-count', {cache: 'no-store'});
        if (!response.ok) return;
        const result = (await response.json()) as {data: {unreadCount: number}};
        if (active) applyUnreadCount(result.data.unreadCount, true);
      } catch {
        // A transient badge failure must not break primary navigation.
      }
    };
    const onUnreadCount = (event: Event) => {
      const detail = (event as CustomEvent<{unreadCount: number}>).detail;
      if (detail) applyUnreadCount(detail.unreadCount, true);
    };
    const unlockSound = () => primeMessageSound();

    void refresh();
    const timer = window.setInterval(() => void refresh(), 12_000);
    window.addEventListener(UNREAD_MESSAGES_EVENT, onUnreadCount);
    window.addEventListener('pointerdown', unlockSound, {once: true});
    window.addEventListener('keydown', unlockSound, {once: true});
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_MESSAGES_EVENT, onUnreadCount);
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, [applyUnreadCount, session.data]);

  useEffect(() => {
    const baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title =
      unreadCount > 0 ? `(${formatBadgeCount(unreadCount)}) ${baseTitle}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [unreadCount]);

  if (session.isPending) {
    return <span className="header-session-loading" aria-hidden="true" />;
  }

  if (!session.data) {
    return (
      <Link className="header-sign-in" href={`/${locale}/auth`} aria-label={labels.signIn}>
        <UserIcon />
        <span>{labels.signIn}</span>
      </Link>
    );
  }

  const displayName = session.data.user.name.trim() || labels.account;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(locale))
    .join('');

  return (
    <div className="header-authenticated">
      <nav className="header-private-nav" aria-label={labels.personalNavigation}>
        <HeaderLink
          href={`/${locale}/messages`}
          label={labels.messages}
          icon={<MessageIcon />}
          badge={unreadCount}
          badgeLabel={labels.unreadMessages}
        />
        <HeaderLink href={`/${locale}/saved`} label={labels.saved} icon={<HeartIcon />} />
        <HeaderLink
          href={`/${locale}/notifications`}
          label={labels.notifications}
          icon={<BellIcon />}
        />
      </nav>
      <details className="header-user-menu">
        <summary aria-label={labels.account}>
          <span className="header-user-avatar-wrap">
            <span className="header-user-avatar" aria-hidden="true">
              {initials || 'S'}
            </span>
            {unreadCount > 0 && (
              <span className="header-unread-badge" aria-label={labels.unreadMessages}>
                {formatBadgeCount(unreadCount)}
              </span>
            )}
          </span>
          <span className="header-user-copy">
            <small>{labels.account}</small>
            <strong>{displayName}</strong>
          </span>
          <ChevronIcon />
        </summary>
        <nav aria-label={labels.personalNavigation}>
          <Link className="header-mobile-private-link" href={`/${locale}/messages`}>
            <MessageIcon /> <span>{labels.messages}</span>
            {unreadCount > 0 && (
              <span className="header-unread-badge" aria-label={labels.unreadMessages}>
                {formatBadgeCount(unreadCount)}
              </span>
            )}
          </Link>
          <Link className="header-mobile-private-link" href={`/${locale}/saved`}>
            <HeartIcon /> {labels.saved}
          </Link>
          <Link className="header-mobile-private-link" href={`/${locale}/notifications`}>
            <BellIcon /> {labels.notifications}
          </Link>
          <Link href={`/${locale}/account`}>
            <UserIcon /> {labels.account}
          </Link>
        </nav>
      </details>
    </div>
  );
}

function HeaderLink({
  href,
  label,
  icon,
  badge = 0,
  badgeLabel
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeLabel?: string;
}) {
  return (
    <Link className="header-private-link" href={href} aria-label={label} title={label}>
      <span className="header-private-icon">
        {icon}
        {badge > 0 && (
          <span className="header-unread-badge" aria-label={badgeLabel}>
            {formatBadgeCount(badge)}
          </span>
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path
        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path
        d="M6 9.5a6 6 0 0 1 12 0c0 6 2.2 6.4 2.2 7.5H3.8C3.8 15.9 6 15.5 6 9.5ZM9.5 20h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path
        d="M12 20.2 4.6 13A4.9 4.9 0 0 1 11.5 6l.5.6.5-.6a4.9 4.9 0 0 1 6.9 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="header-user-chevron"
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
    >
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
