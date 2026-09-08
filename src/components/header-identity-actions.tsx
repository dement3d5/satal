'use client';

import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';
import {authClient} from '@/modules/identity/auth-client';

interface HeaderIdentityLabels {
  messages: string;
  saved: string;
  notifications: string;
  account: string;
  signIn: string;
  personalNavigation: string;
}

export function HeaderIdentityActions({
  locale,
  labels
}: {
  locale: AppLocale;
  labels: HeaderIdentityLabels;
}) {
  const session = authClient.useSession();

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
        <HeaderLink href={`/${locale}/messages`} label={labels.messages} icon={<MessageIcon />} />
        <HeaderLink href={`/${locale}/saved`} label={labels.saved} icon={<HeartIcon />} />
        <HeaderLink
          href={`/${locale}/notifications`}
          label={labels.notifications}
          icon={<BellIcon />}
        />
      </nav>
      <details className="header-user-menu">
        <summary aria-label={labels.account}>
          <span className="header-user-avatar" aria-hidden="true">
            {initials || 'S'}
          </span>
          <span className="header-user-copy">
            <small>{labels.account}</small>
            <strong>{displayName}</strong>
          </span>
          <ChevronIcon />
        </summary>
        <nav aria-label={labels.personalNavigation}>
          <Link className="header-mobile-private-link" href={`/${locale}/messages`}>
            <MessageIcon /> {labels.messages}
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

function HeaderLink({href, label, icon}: {href: string; label: string; icon: React.ReactNode}) {
  return (
    <Link className="header-private-link" href={href} aria-label={label} title={label}>
      {icon}
      <span>{label}</span>
    </Link>
  );
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
