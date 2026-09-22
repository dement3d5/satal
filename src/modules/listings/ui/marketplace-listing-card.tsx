import Image from 'next/image';
import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';

import type {PublicListingCard} from '../public-listing-service';
import {formatPrice} from './format';

export function MarketplaceListingCard({
  item,
  locale,
  labels,
  priority = false
}: {
  item: PublicListingCard;
  locale: AppLocale;
  labels: {priceOnRequest: string; yes: string; no: string};
  priority?: boolean;
}) {
  return (
    <article className="market-card">
      <Link href={`/${locale}/listings/${item.id}`} aria-label={item.title}>
        <div className="market-card-media">
          {item.mediaUrl ? (
            <Image
              alt={item.title}
              fill
              priority={priority}
              sizes="(max-width: 42rem) 78vw, (max-width: 70rem) 31vw, 22vw"
              src={item.mediaUrl}
              unoptimized
            />
          ) : (
            <div className="market-card-placeholder" aria-hidden="true">
              <ListingPlaceholderIcon />
              <span>SATAL</span>
            </div>
          )}
          <span className="market-card-date">{formatDate(item.publishedAt, locale)}</span>
        </div>
        <div className="market-card-body">
          <strong className="market-card-price">
            {formatPrice(item.priceMinor, item.currency, locale, labels.priceOnRequest)}
          </strong>
          <h3>{item.title}</h3>
          <p className="market-card-location">
            <LocationIcon />
            <span>{item.locationName}</span>
          </p>
          {item.facts.length > 0 && (
            <ul className="market-card-facts">
              {item.facts.map((fact) => (
                <li key={fact.attributeId} title={fact.label}>
                  <strong>
                    {typeof fact.value === 'boolean'
                      ? fact.value
                        ? labels.yes
                        : labels.no
                      : String(fact.value)}
                    {fact.unit ? ` ${fact.unit}` : ''}
                  </strong>
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  );
}

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    day: 'numeric',
    month: 'short'
  }).format(new Date(value));
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
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
