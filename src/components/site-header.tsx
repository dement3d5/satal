import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

import type {AppLocale} from '@/i18n/routing';

import {HeaderIdentityActions} from './header-identity-actions';
import {LanguageSwitcher} from './language-switcher';

interface SiteHeaderProps {
  locale: AppLocale;
  languageLabel: string;
  sellLabel: string;
  savedLabel?: string;
  accountLabel: string;
}

export async function SiteHeader({
  locale,
  languageLabel,
  sellLabel,
  savedLabel,
  accountLabel
}: SiteHeaderProps) {
  const navigation = await getTranslations('navigation');
  return (
    <header className="site-header">
      <Link className="brand" href={`/${locale}`} aria-label="Satal">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span>Satal</span>
      </Link>

      <div className="header-actions">
        <HeaderIdentityActions
          locale={locale}
          labels={{
            messages: navigation('messages'),
            notifications: navigation('notifications'),
            saved: savedLabel ?? navigation('saved'),
            account: accountLabel,
            signIn: navigation('signIn'),
            personalNavigation: navigation('personalNavigation')
          }}
        />
        <LanguageSwitcher locale={locale} label={languageLabel} />
        <Link
          className="button button-primary header-sell"
          href={`/${locale}/sell`}
          aria-label={sellLabel}
        >
          <PlusIcon />
          <span>{sellLabel}</span>
        </Link>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <path
        d="M10 4v12M4 10h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
