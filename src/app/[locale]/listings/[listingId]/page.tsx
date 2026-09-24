import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';

import {ImageGallery} from '@/components/image-gallery';
import {LocationMap} from '@/components/location-map';
import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {StartConversation} from '@/modules/chat/ui/start-conversation';
import {FavoriteButton} from '@/modules/engagement/ui/favorite-button';
import {ContactButton} from '@/modules/identity/ui/contact-button';
import {
  getPublicListing,
  listSimilarPublicListings
} from '@/modules/listings/public-listing-service';
import {formatPrice} from '@/modules/listings/ui/format';
import {MarketplaceListingCard} from '@/modules/listings/ui/marketplace-listing-card';
import {ReportListing} from '@/modules/moderation/ui/report-listing';
import {getPublicReputationSummary} from '@/modules/reputation/service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {parseUuid} from '@/server/http/params';

type PageProps = {params: Promise<{locale: AppLocale; listingId: string}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, listingId: rawListingId} = await params;
  try {
    const item = await getPublicListing(
      getDatabase(),
      locale,
      parseUuid(rawListingId, 'listingId')
    );
    return {title: `${item.title} — Satal`, description: item.description.slice(0, 160)};
  } catch {
    return {title: 'Satal'};
  }
}

export default async function ListingPage({params}: PageProps) {
  const {locale, listingId: rawListingId} = await params;
  const t = await getTranslations('listing');
  const database = getDatabase();
  let item;
  try {
    item = await getPublicListing(database, locale, parseUuid(rawListingId, 'listingId'));
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const [reputation, similar] = await Promise.all([
    getPublicReputationSummary(database, item.sellerId),
    listSimilarPublicListings(database, locale, {
      listingId: item.id,
      categoryId: item.categoryId,
      locationId: item.locationId,
      limit: 4
    })
  ]);

  return (
    <main className="page-shell listing-page-shell">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        savedLabel={t('savedLink')}
        accountLabel={t('accountLink')}
      />
      <article className="listing-detail">
        <header className="listing-detail-header">
          <nav className="listing-breadcrumb" aria-label={t('breadcrumbLabel')}>
            <Link href={`/${locale}`}>{t('home')}</Link>
            <span aria-hidden="true">/</span>
            <Link
              href={`/${locale}/search?categoryId=${item.categoryId}&locationId=${item.locationId}`}
            >
              {item.categoryName}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{item.locationName}</span>
          </nav>
          <div className="listing-title-row">
            <div>
              <h1>{item.title}</h1>
              <p>
                <LocationIcon />
                {item.locationName}
                <span aria-hidden="true">·</span>
                {t('publishedAt', {date: formatDate(item.publishedAt, locale)})}
              </p>
            </div>
            <FavoriteButton
              listingId={item.id}
              labels={{
                add: t('favoriteAdd'),
                remove: t('favoriteRemove'),
                auth: t('favoriteAuth'),
                error: t('favoriteError')
              }}
            />
          </div>
        </header>

        <ImageGallery
          alt={item.title}
          className="listing-detail-gallery"
          labels={{
            empty: t('mediaPlaceholder'),
            previous: t('mediaPrevious'),
            next: t('mediaNext'),
            count: t('mediaCount'),
            openAll: t('mediaOpenAll'),
            close: t('mediaClose')
          }}
          layout="collage"
          priority
          urls={item.mediaUrls}
        />

        <div className="listing-detail-layout">
          <div className="listing-detail-main">
            {item.attributes.length > 0 && (
              <section className="listing-attributes" aria-labelledby="attributes-title">
                <div className="listing-section-title">
                  <span aria-hidden="true">
                    <DetailsIcon />
                  </span>
                  <div>
                    <p>{t('attributesKicker')}</p>
                    <h2 id="attributes-title">{t('attributesTitle')}</h2>
                  </div>
                </div>
                <dl>
                  {item.attributes.map((attribute) => (
                    <div key={attribute.attributeId}>
                      <dt>{attribute.label}</dt>
                      <dd>
                        {Array.isArray(attribute.value)
                          ? attribute.value.join(', ')
                          : typeof attribute.value === 'boolean'
                            ? attribute.value
                              ? t('yes')
                              : t('no')
                            : String(attribute.value)}
                        {attribute.unit ? ` ${attribute.unit}` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="listing-description" aria-labelledby="description-title">
              <div className="listing-section-title">
                <span aria-hidden="true">
                  <DescriptionIcon />
                </span>
                <div>
                  <p>{t('descriptionKicker')}</p>
                  <h2 id="description-title">{t('descriptionTitle')}</h2>
                </div>
              </div>
              <p>{item.description}</p>
            </section>

            <section className="listing-location-card" aria-labelledby="listing-location-title">
              <div className="listing-section-title">
                <span aria-hidden="true">
                  <LocationIcon />
                </span>
                <div>
                  <p>{t('locationKicker')}</p>
                  <h2 id="listing-location-title">{item.locationName}</h2>
                </div>
              </div>
              {item.mapLatitude !== null && item.mapLongitude !== null ? (
                <LocationMap
                  label={t('mapLabel')}
                  point={{latitude: item.mapLatitude, longitude: item.mapLongitude}}
                />
              ) : (
                <div className="listing-location-map-empty">
                  <LocationIcon />
                  <span>{t('mapUnavailable')}</span>
                </div>
              )}
              {item.publicLocationLabel && (
                <p className="listing-location-label">{item.publicLocationLabel}</p>
              )}
              <p>{t('locationPrivacy')}</p>
            </section>
          </div>

          <aside className="seller-card">
            <section className="listing-price-card">
              <span>{t('priceLabel')}</span>
              <strong>
                {formatPrice(item.priceMinor, item.currency, locale, t('priceOnRequest'))}
              </strong>
              <small>{t('priceHint')}</small>
            </section>
            <section className="seller-card-profile">
              <div className="seller-card-heading">
                <span className="seller-avatar" aria-hidden="true">
                  {item.sellerName.slice(0, 1).toLocaleUpperCase(locale)}
                </span>
                <div>
                  <small>{item.shopId ? t('shopLabel') : t('sellerLabel')}</small>
                  {item.shopId && item.shopSlug && item.shopName ? (
                    <Link href={`/${locale}/shops/${item.shopSlug}`}>
                      <strong>
                        {item.shopName} {item.shopVerified ? '✓' : ''}
                      </strong>
                    </Link>
                  ) : (
                    <Link href={`/${locale}/users/${item.sellerId}`}>
                      <strong>{item.sellerName}</strong>
                    </Link>
                  )}
                  <span>
                    {reputation.count > 0
                      ? `${reputation.average.toFixed(1)} ★ · ${t('sellerReviews', {count: reputation.count})}`
                      : t('sellerNoReviews')}
                  </span>
                </div>
              </div>
              <ContactButton
                listingId={item.id}
                locale={locale}
                labels={{
                  action: t('contactAction'),
                  loading: t('contactLoading'),
                  signIn: t('contactSignIn'),
                  unavailable: t('contactUnavailable'),
                  limit: t('contactLimit'),
                  error: t('contactError'),
                  privacy: t('contactPrivacy')
                }}
              />
              <StartConversation
                listingId={item.id}
                locale={locale}
                labels={{
                  action: t('messageAction'),
                  title: t('messageTitle'),
                  placeholder: t('messagePlaceholder'),
                  send: t('messageSend'),
                  sending: t('messageSending'),
                  signIn: t('messageSignIn'),
                  unavailable: t('messageUnavailable'),
                  rateLimit: t('messageRateLimit'),
                  error: t('messageError'),
                  safety: t('messageSafety')
                }}
              />
              <ReportListing
                listingId={item.id}
                locale={locale}
                labels={{
                  action: t('reportAction'),
                  title: t('reportTitle'),
                  reason: t('reportReason'),
                  details: t('reportDetails'),
                  detailsHint: t('reportDetailsHint'),
                  submit: t('reportSubmit'),
                  submitting: t('reportSubmitting'),
                  received: t('reportReceived'),
                  signIn: t('reportSignIn'),
                  limit: t('reportLimit'),
                  error: t('reportError'),
                  reasons: {
                    fraud: t('reportReasons.fraud'),
                    wrong_category: t('reportReasons.wrongCategory'),
                    prohibited_item: t('reportReasons.prohibitedItem'),
                    duplicate: t('reportReasons.duplicate'),
                    misleading_price: t('reportReasons.misleadingPrice'),
                    stale_listing: t('reportReasons.staleListing'),
                    other: t('reportReasons.other')
                  }
                }}
              />
            </section>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="listing-similar" aria-labelledby="similar-listings-title">
            <header className="home-collection-heading">
              <div>
                <p>{item.categoryName}</p>
                <h2 id="similar-listings-title">{t('similarTitle')}</h2>
              </div>
              <Link
                href={`/${locale}/search?categoryId=${item.categoryId}&locationId=${item.locationId}`}
              >
                {t('similarAction')}
              </Link>
            </header>
            <div className="home-listing-rail">
              {similar.map((similarItem) => (
                <MarketplaceListingCard
                  item={similarItem}
                  key={similarItem.id}
                  labels={{priceOnRequest: t('priceOnRequest'), yes: t('yes'), no: t('no')}}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}

function formatDate(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
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

function DetailsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="11" cy="17" r="1.5" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4" />
    </svg>
  );
}
