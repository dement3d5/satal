import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import {formatPrice} from '@/modules/listings/ui/format';
import {getPublicShop} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';

type Props = {params: Promise<{locale: AppLocale; slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, slug} = await params;
  try {
    const shop = await getPublicShop(getDatabase(), locale, slug);
    return {title: `${shop.name} — Satal`, description: shop.description.slice(0, 160)};
  } catch {
    return {title: 'Satal'};
  }
}

export default async function StorefrontPage({params}: Props) {
  const {locale, slug} = await params;
  const t = await getTranslations('shop');
  let shop;
  try {
    shop = await getPublicShop(getDatabase(), locale, slug);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return (
    <main className="page-shell storefront-page">
      <SiteHeader
        accountLabel={t('accountLink')}
        languageLabel={t('languageNavigation')}
        locale={locale}
        sellLabel={t('sellAction')}
      />
      <article className="storefront">
        <div
          className={shop.coverUrl ? 'storefront-cover has-image' : 'storefront-cover'}
          style={
            shop.coverUrl ? {backgroundImage: `url(${JSON.stringify(shop.coverUrl)})`} : undefined
          }
        />
        <header className="storefront-header">
          <div className="storefront-logo">
            {shop.logoUrl ? (
              <span
                aria-hidden="true"
                className="shop-logo-image"
                style={{backgroundImage: `url(${JSON.stringify(shop.logoUrl)})`}}
              />
            ) : (
              shop.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="storefront-title">
            <div>
              <h1>{shop.name}</h1>
              {shop.verificationStatus === 'verified' && (
                <span className="storefront-verified">✓ {t('verifiedShop')}</span>
              )}
            </div>
            <p>
              {shop.locationName ?? t('locationNotSpecified')}
              {shop.publicAddress ? ` · ${shop.publicAddress}` : ''}
            </p>
          </div>
          {shop.publicPhone && (
            <a className="button button-primary" href={`tel:${shop.publicPhone}`}>
              {t('callShop')}
            </a>
          )}
        </header>
        <div className="storefront-about-grid">
          <section>
            <span>{t('aboutShop')}</span>
            <p>{shop.description || t('descriptionMissing')}</p>
          </section>
          <aside>
            <span>{t('businessHours')}</span>
            {shop.businessHours.length ? (
              <dl>
                {shop.businessHours.map((item) => (
                  <div key={item.weekday}>
                    <dt>{t(`weekdays.${item.weekday}`)}</dt>
                    <dd>
                      {item.isClosed
                        ? t('closed')
                        : `${formatMinute(item.opensAtMinute!)}–${formatMinute(item.closesAtMinute!)}`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>{t('hoursMissing')}</p>
            )}
          </aside>
        </div>
        <section className="storefront-listings">
          <div className="section-heading">
            <div>
              <span className="section-mark" aria-hidden="true" />
              <h2>{t('storefrontListings')}</h2>
            </div>
            <span>{t('listingCount', {count: shop.listings.length})}</span>
          </div>
          {shop.listings.length ? (
            <div className="listing-grid">
              {shop.listings.map((item) => (
                <Link
                  className="listing-card"
                  href={`/${locale}/listings/${item.id}`}
                  key={item.id}
                >
                  <div
                    className={
                      item.mediaUrl ? 'listing-card-media has-photo' : 'listing-card-media'
                    }
                    style={
                      item.mediaUrl
                        ? {backgroundImage: `url(${JSON.stringify(item.mediaUrl)})`}
                        : undefined
                    }
                  />
                  <div className="listing-card-body">
                    <strong className="listing-price">
                      {formatPrice(item.priceMinor, item.currency, locale, t('priceOnRequest'))}
                    </strong>
                    <h3>{item.title}</h3>
                    <p>{item.categoryName}</p>
                    <span>{item.locationName}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="listing-empty">
              <strong>{t('storefrontEmptyTitle')}</strong>
              <span>{t('storefrontEmptyText')}</span>
            </div>
          )}
        </section>
      </article>
    </main>
  );
}

function formatMinute(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
