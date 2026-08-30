import {connection} from 'next/server';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';
import {getDatabase} from '@/server/db/client';

import {listPublicListings} from '../public-listing-service';

export async function PublicListingFeed({locale}: {locale: AppLocale}) {
  await connection();
  const t = await getTranslations('home');

  try {
    const {items} = await listPublicListings(getDatabase(), locale, {limit: 12});
    if (!items.length) {
      return (
        <section className="listing-section" aria-labelledby="listing-feed-title">
          <ListingSectionHeading title={t('listingFeedTitle')} action={t('listingFeedAction')} />
          <div className="listing-empty">
            <strong>{t('listingEmptyTitle')}</strong>
            <span>{t('listingEmptyText')}</span>
            <Link className="button button-primary" href={`/${locale}/sell`}>
              {t('sellAction')}
            </Link>
          </div>
        </section>
      );
    }

    return (
      <section className="listing-section" aria-labelledby="listing-feed-title">
        <ListingSectionHeading title={t('listingFeedTitle')} action={t('listingFeedAction')} />
        <div className="listing-grid">
          {items.map((item) => (
            <Link className="listing-card" href={`/${locale}/listings/${item.id}`} key={item.id}>
              <div className="listing-card-media" aria-hidden="true">
                <ListingPlaceholderIcon />
              </div>
              <div className="listing-card-body">
                <strong className="listing-price">
                  {formatPrice(item.priceMinor, item.currency, locale, t('priceOnRequest'))}
                </strong>
                <h3>{item.title}</h3>
                <p>{item.categoryName}</p>
                <span>
                  {item.locationName} · {formatDate(item.publishedAt, locale)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  } catch {
    return (
      <section className="listing-section" aria-labelledby="listing-feed-title">
        <ListingSectionHeading title={t('listingFeedTitle')} action={t('listingFeedAction')} />
        <div className="listing-empty listing-empty-quiet">
          <strong>{t('listingUnavailableTitle')}</strong>
          <span>{t('listingUnavailableText')}</span>
        </div>
      </section>
    );
  }
}

export function PublicListingFeedSkeleton() {
  return (
    <section className="listing-section" aria-busy="true" aria-label="Loading listings">
      <div className="section-heading skeleton-heading" />
      <div className="listing-grid">
        {Array.from({length: 4}, (_, index) => (
          <div className="listing-card listing-card-skeleton" key={index} />
        ))}
      </div>
    </section>
  );
}

function ListingSectionHeading({title, action}: {title: string; action: string}) {
  return (
    <div className="section-heading">
      <div>
        <span className="section-mark" aria-hidden="true" />
        <h2 id="listing-feed-title">{title}</h2>
      </div>
      <span>{action}</span>
    </div>
  );
}

export function formatPrice(
  priceMinor: number | null,
  currency: string,
  locale: AppLocale,
  fallback: string
): string {
  if (priceMinor === null) return fallback;
  return new Intl.NumberFormat(locale === 'az' ? 'az-AZ' : locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: priceMinor % 100 === 0 ? 0 : 2
  }).format(priceMinor / 100);
}

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    day: 'numeric',
    month: 'short'
  }).format(new Date(value));
}

function ListingPlaceholderIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M10 13h28v22H10z" />
      <circle cx="19" cy="21" r="3" />
      <path d="m13 32 8-8 5 5 4-4 5 7" />
    </svg>
  );
}
