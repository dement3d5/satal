import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {getPublicListing} from '@/modules/listings/public-listing-service';
import {formatPrice} from '@/modules/listings/ui/public-listings';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {parseUuid} from '@/server/http/params';

type PageProps = {params: Promise<{locale: AppLocale; listingId: string}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, listingId: rawListingId} = await params;
  try {
    const item = await getPublicListing(getDatabase(), locale, parseUuid(rawListingId, 'listingId'));
    return {title: `${item.title} — Satal`, description: item.description.slice(0, 160)};
  } catch {
    return {title: 'Satal'};
  }
}

export default async function ListingPage({params}: PageProps) {
  const {locale, listingId: rawListingId} = await params;
  const t = await getTranslations('listing');
  let item;
  try {
    item = await getPublicListing(getDatabase(), locale, parseUuid(rawListingId, 'listingId'));
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  return (
    <main className="page-shell">
      <SiteHeader locale={locale} languageLabel={t('languageNavigation')} sellLabel={t('sellAction')} />
      <article className="listing-detail">
        <div className="listing-detail-media" aria-label={t('mediaPlaceholder')}>
          <span>SATAL</span>
          <strong>{t('mediaPlaceholder')}</strong>
        </div>
        <div className="listing-detail-main">
          <nav className="listing-breadcrumb" aria-label={t('breadcrumbLabel')}>
            <a href={`/${locale}`}>{t('home')}</a>
            <span aria-hidden="true">/</span>
            <span>{item.categoryName}</span>
          </nav>
          <h1>{item.title}</h1>
          <strong className="listing-detail-price">
            {formatPrice(item.priceMinor, item.currency, locale, t('priceOnRequest'))}
          </strong>
          <p className="listing-detail-location">{item.locationName}</p>

          {item.attributes.length > 0 && (
            <section className="listing-attributes" aria-labelledby="attributes-title">
              <h2 id="attributes-title">{t('attributesTitle')}</h2>
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
            <h2 id="description-title">{t('descriptionTitle')}</h2>
            <p>{item.description}</p>
          </section>
        </div>
        <aside className="seller-card">
          <span>{t('sellerLabel')}</span>
          <strong>{item.sellerName}</strong>
          <button type="button" disabled title={t('contactSoon')}>
            {t('contactAction')}
          </button>
          <small>{t('contactSoon')}</small>
        </aside>
      </article>
    </main>
  );
}
