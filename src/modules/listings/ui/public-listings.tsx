import {connection} from 'next/server';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';
import {getDatabase} from '@/server/db/client';

import {listPublicListings, type PublicListingCard} from '../public-listing-service';
import {formatPrice} from './format';

export async function PublicListingFeed({locale}: {locale: AppLocale}) {
  await connection();
  const t = await getTranslations('home');

  let items: PublicListingCard[] = [];
  let unavailable = false;
  try {
    ({items} = await listPublicListings(getDatabase(), locale, {limit: 12}));
  } catch {
    unavailable = true;
  }

  if (unavailable) {
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
            <div
              className={item.mediaUrl ? 'listing-card-media has-photo' : 'listing-card-media'}
              aria-hidden="true"
              style={
                item.mediaUrl
                  ? {backgroundImage: `url(${JSON.stringify(item.mediaUrl)})`}
                  : undefined
              }
            >
              {!item.mediaUrl && <ListingPlaceholderIcon />}
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
