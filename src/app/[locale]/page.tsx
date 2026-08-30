import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {Suspense} from 'react';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {
  PublicListingFeed,
  PublicListingFeedSkeleton
} from '@/modules/listings/ui/public-listings';

export default async function HomePage({params}: {params: Promise<{locale: AppLocale}>}) {
  const {locale} = await params;
  const t = await getTranslations('home');

  return (
    <main className="page-shell">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
      />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h1 id="hero-title">{t('title')}</h1>
          <p>{t('description')}</p>
          <div className="search" role="search">
            <label className="sr-only" htmlFor="marketplace-search">
              {t('searchLabel')}
            </label>
            <SearchIcon />
            <input id="marketplace-search" name="q" placeholder={t('searchPlaceholder')} />
            <button type="button" disabled title={t('searchSoon')}>
              {t('searchAction')}
            </button>
          </div>
          <div className="hero-actions">
            <Link className="button button-primary" href={`/${locale}/sell`}>
              {t('sellAction')}
            </Link>
            <span>{t('sellHint')}</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-card visual-card-main">
            <span className="visual-kicker">SATAL</span>
            <strong>{t('visualTitle')}</strong>
            <span>{t('visualMeta')}</span>
          </div>
          <div className="visual-card visual-card-small">
            <span>₼</span>
            <strong>24 900</strong>
          </div>
          <div className="visual-orbit visual-orbit-one" />
          <div className="visual-orbit visual-orbit-two" />
        </div>
      </section>

      <section className="trust-row" aria-label={t('trustLabel')}>
        <div>
          <ShieldIcon />
          <span>
            <strong>{t('trustSafeTitle')}</strong>
            {t('trustSafeText')}
          </span>
        </div>
        <div>
          <LocationIcon />
          <span>
            <strong>{t('trustLocationTitle')}</strong>
            {t('trustLocationText')}
          </span>
        </div>
        <div>
          <SparkIcon />
          <span>
            <strong>{t('trustSimpleTitle')}</strong>
            {t('trustSimpleText')}
          </span>
        </div>
      </section>

      <Suspense fallback={<PublicListingFeedSkeleton />}>
        <PublicListingFeed locale={locale} />
      </Suspense>
    </main>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    </svg>
  );
}
