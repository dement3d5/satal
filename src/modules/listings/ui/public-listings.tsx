import {connection} from 'next/server';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import type {AppLocale} from '@/i18n/routing';
import {getDatabase} from '@/server/db/client';

import {listHomepageCollections, type HomepageListingCollection} from '../public-listing-service';
import {MarketplaceListingCard} from './marketplace-listing-card';

export async function PublicListingFeed({locale}: {locale: AppLocale}) {
  await connection();
  const t = await getTranslations('home');

  let collections: HomepageListingCollection[] = [];
  let unavailable = false;
  try {
    collections = await listHomepageCollections(getDatabase(), locale);
  } catch {
    unavailable = true;
  }

  const city = collections[0]?.locationName ?? t('baku');
  const locationId = collections[0]?.locationId;

  return (
    <>
      <section className="home-discovery" aria-labelledby="home-discovery-title">
        <div className="home-discovery-copy">
          <h1 id="home-discovery-title">{t('cityKicker', {city})}</h1>
        </div>
        <form className="home-search" role="search" action={`/${locale}/search`}>
          <label className="sr-only" htmlFor="home-marketplace-search">
            {t('searchLabel')}
          </label>
          <span className="home-search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input id="home-marketplace-search" name="q" placeholder={t('searchPlaceholder')} />
          <label className="home-search-category">
            <span className="sr-only">{t('searchCategory')}</span>
            <select name="categoryId" defaultValue="">
              <option value="">{t('searchAll')}</option>
              {collections.map((collection) => (
                <option key={collection.key} value={collection.categoryId}>
                  {collection.categoryName}
                </option>
              ))}
            </select>
          </label>
          {locationId && <input name="locationId" type="hidden" value={locationId} />}
          <button type="submit">
            <SearchIcon />
            <span>{t('searchAction')}</span>
          </button>
        </form>
        {collections.length > 0 && (
          <nav className="home-category-nav" aria-label={t('categoryNavigation')}>
            {collections.map((collection) => (
              <Link
                href={collectionHref(locale, collection)}
                key={collection.key}
                className={`home-category-tile home-category-${collection.key}`}
              >
                <span aria-hidden="true">
                  {collection.key === 'apartments' ? <ApartmentIcon /> : <CarIcon />}
                </span>
                <span>
                  <strong>{collection.categoryName}</strong>
                  <small>{t('categoryInCity', {city: collection.locationName})}</small>
                </span>
                <ArrowIcon />
              </Link>
            ))}
          </nav>
        )}
      </section>

      {unavailable ? (
        <section className="home-collection" aria-labelledby="home-listings-unavailable">
          <div className="listing-empty listing-empty-quiet">
            <strong id="home-listings-unavailable">{t('listingUnavailableTitle')}</strong>
            <span>{t('listingUnavailableText')}</span>
          </div>
        </section>
      ) : (
        collections.map((collection, collectionIndex) => (
          <HomeCollection
            collection={collection}
            collectionIndex={collectionIndex}
            key={collection.key}
            locale={locale}
            labels={{
              title: collection.key === 'apartments' ? t('apartmentsTitle') : t('carsTitle'),
              subtitle: t('collectionSubtitle', {city: collection.locationName}),
              viewAll: t('viewAll'),
              emptyTitle:
                collection.key === 'apartments' ? t('apartmentsEmptyTitle') : t('carsEmptyTitle'),
              emptyText: t('collectionEmptyText'),
              priceOnRequest: t('priceOnRequest'),
              sellAction: t('sellAction'),
              yes: t('yes'),
              no: t('no')
            }}
          />
        ))
      )}
    </>
  );
}

function HomeCollection({
  collection,
  collectionIndex,
  locale,
  labels
}: {
  collection: HomepageListingCollection;
  collectionIndex: number;
  locale: AppLocale;
  labels: {
    title: string;
    subtitle: string;
    viewAll: string;
    emptyTitle: string;
    emptyText: string;
    priceOnRequest: string;
    sellAction: string;
    yes: string;
    no: string;
  };
}) {
  const titleId = `home-${collection.key}-title`;
  return (
    <section className="home-collection" id={`home-${collection.key}`} aria-labelledby={titleId}>
      <header className="home-collection-heading">
        <div>
          <p>{labels.subtitle}</p>
          <h2 id={titleId}>{labels.title}</h2>
        </div>
        <Link href={collectionHref(locale, collection)}>
          <span>{labels.viewAll}</span>
          <ArrowIcon />
        </Link>
      </header>
      {collection.items.length > 0 ? (
        <div className="home-listing-rail">
          {collection.items.map((item, itemIndex) => (
            <MarketplaceListingCard
              item={item}
              key={item.id}
              labels={{
                priceOnRequest: labels.priceOnRequest,
                yes: labels.yes,
                no: labels.no
              }}
              locale={locale}
              priority={collectionIndex === 0 && itemIndex < 2}
            />
          ))}
        </div>
      ) : (
        <div className="home-collection-empty">
          <span aria-hidden="true">
            {collection.key === 'apartments' ? <ApartmentIcon /> : <CarIcon />}
          </span>
          <div>
            <strong>{labels.emptyTitle}</strong>
            <p>{labels.emptyText}</p>
          </div>
          <Link className="button button-primary" href={`/${locale}/sell`}>
            <span aria-hidden="true">+</span>
            <span className="sr-only">{labels.sellAction}</span>
          </Link>
        </div>
      )}
    </section>
  );
}

export function PublicListingFeedSkeleton() {
  return (
    <div className="home-loading" aria-busy="true">
      <div className="home-discovery home-discovery-skeleton">
        <span />
        <span />
        <span />
      </div>
      {Array.from({length: 2}, (_, section) => (
        <section className="home-collection" key={section}>
          <div className="home-collection-heading skeleton-heading" />
          <div className="home-listing-rail">
            {Array.from({length: 4}, (_, index) => (
              <div className="market-card listing-card-skeleton" key={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function collectionHref(locale: AppLocale, collection: HomepageListingCollection): string {
  const params = new URLSearchParams({
    categoryId: collection.categoryId,
    locationId: collection.locationId,
    sort: 'newest'
  });
  return `/${locale}/search?${params}`;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function ApartmentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="M5 28V9l11-5 11 5v19M10 12h4M18 12h4M10 17h4M18 17h4M10 22h4M18 22h4M14 28v-3h4v3" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="m5 19 2-7c.4-1.3 1.5-2 2.8-2h12.4c1.3 0 2.4.7 2.8 2l2 7M4 19h24v7H4zM8 26v2M24 26v2M8 21h3M21 21h3M10 10l2-4h8l2 4" />
    </svg>
  );
}
