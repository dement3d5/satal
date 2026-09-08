'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

import {localizePathname} from '@/i18n/path';
import {routing, type AppLocale} from '@/i18n/routing';

export function LanguageSwitcher({locale, label}: {locale: AppLocale; label: string}) {
  const pathname = usePathname();
  return (
    <details className="language-menu">
      <summary aria-label={label}>
        <GlobeIcon />
        <span>{locale.toUpperCase()}</span>
        <ChevronIcon />
      </summary>
      <nav aria-label={label}>
        {routing.locales.map((item) => (
          <Link
            aria-current={item === locale ? 'page' : undefined}
            className={item === locale ? 'is-active' : undefined}
            href={localizePathname(pathname, item)}
            key={item}
            lang={item}
          >
            <span>{item.toUpperCase()}</span>
            {item === locale && <span aria-hidden="true">✓</span>}
          </Link>
        ))}
      </nav>
    </details>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 12h17M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3c-2.2 2.4-3.3 5.4-3.3 9S9.8 18.6 12 21"
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
    <svg className="language-chevron" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
