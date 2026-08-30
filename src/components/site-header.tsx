import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';

interface SiteHeaderProps {
  locale: AppLocale;
  languageLabel: string;
  sellLabel: string;
}

export function SiteHeader({locale, languageLabel, sellLabel}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="brand" href={`/${locale}`} aria-label="Satal">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span>Satal</span>
      </Link>

      <div className="header-actions">
        <nav className="language-nav" aria-label={languageLabel}>
          {(['az', 'ru', 'en'] as const).map((item) => (
            <Link
              className={item === locale ? 'is-active' : undefined}
              href={`/${item}`}
              key={item}
              lang={item}
            >
              {item.toUpperCase()}
            </Link>
          ))}
        </nav>
        <Link className="button button-primary header-sell" href={`/${locale}/sell`}>
          <PlusIcon />
          {sellLabel}
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
