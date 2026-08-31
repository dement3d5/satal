import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import type {CategoryAttributeContract, CategoryNodeContract} from '@/modules/catalog/contracts';
import {getCategorySchema, listCategoryTree} from '@/modules/catalog/repository';
import {listFilterLocations} from '@/modules/geography/repository';
import type {PublicListingCard} from '@/modules/listings/public-listing-service';
import {formatPrice} from '@/modules/listings/ui/public-listings';
import {parseSearchParams} from '@/modules/search/contracts';
import {searchListings} from '@/modules/search/search-service';
import {getDatabase} from '@/server/db/client';

export default async function SearchPage({
  params,
  searchParams
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{locale}, raw, t] = await Promise.all([params, searchParams, getTranslations('search')]);
  const url = toUrlSearchParams(raw);
  const query = parseSearchParams(url);
  const db = getDatabase();
  const [categories, locations, result, schema] = await Promise.all([
    listCategoryTree(db, locale),
    listFilterLocations(db, locale),
    searchListings(db, locale, query),
    query.categoryId ? getCategorySchema(db, query.categoryId, locale) : null
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <main className="page-shell search-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
      />
      <header className="search-page-heading">
        <p className="eyebrow">SATAL SEARCH</p>
        <h1>{t('title')}</h1>
        <p>{t('resultCount', {count: result.total})}</p>
      </header>
      <form className="search-filters" action={`/${locale}/search`}>
        <label>
          {t('query')}
          <input name="q" defaultValue={query.q} placeholder={t('queryPlaceholder')} />
        </label>
        <label>
          {t('category')}
          <select name="categoryId" defaultValue={query.categoryId ?? ''}>
            <option value="">{t('allCategories')}</option>
            {flattenCategories(categories).map((item) => (
              <option key={item.id} value={item.id}>
                {'— '.repeat(item.depth)}
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('location')}
          <select name="locationId" defaultValue={query.locationId ?? ''}>
            <option value="">{t('allLocations')}</option>
            {locations
              .filter((item) => item.depth > 0)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {'— '.repeat(Math.max(0, item.depth - 1))}
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t('priceMin')}
          <input
            name="priceMin"
            type="number"
            min="0"
            step="0.01"
            defaultValue={query.priceMinMinor === undefined ? '' : query.priceMinMinor / 100}
          />
        </label>
        <label>
          {t('priceMax')}
          <input
            name="priceMax"
            type="number"
            min="0"
            step="0.01"
            defaultValue={query.priceMaxMinor === undefined ? '' : query.priceMaxMinor / 100}
          />
        </label>
        <label>
          {t('sort')}
          <select name="sort" defaultValue={query.sort}>
            <option value="relevance">{t('relevance')}</option>
            <option value="newest">{t('newest')}</option>
            <option value="price_asc">{t('priceAsc')}</option>
            <option value="price_desc">{t('priceDesc')}</option>
          </select>
        </label>
        {schema?.attributes
          .filter((attribute) => attribute.filterable)
          .map((attribute) => (
            <DynamicFilter key={attribute.id} attribute={attribute} params={url} />
          ))}
        <button className="button button-primary" type="submit">
          {t('apply')}
        </button>
        <Link className="button" href={`/${locale}/search`}>
          {t('reset')}
        </Link>
      </form>
      {result.degraded && <p className="search-notice">{t('degraded')}</p>}
      {result.items.length ? (
        <SearchGrid items={result.items} locale={locale} fallback={t('priceOnRequest')} />
      ) : (
        <div className="listing-empty">
          <strong>{t('emptyTitle')}</strong>
          <span>{t('emptyText')}</span>
        </div>
      )}
      <nav className="search-pagination" aria-label={t('pagination')}>
        {query.page > 1 && (
          <Link href={pageHref(locale, url, query.page - 1)}>{t('previous')}</Link>
        )}
        <span>{t('page', {page: query.page, total: totalPages})}</span>
        {query.page < totalPages && (
          <Link href={pageHref(locale, url, query.page + 1)}>{t('next')}</Link>
        )}
      </nav>
    </main>
  );
}

function DynamicFilter({
  attribute,
  params
}: {
  attribute: CategoryAttributeContract;
  params: URLSearchParams;
}) {
  if (attribute.valueType === 'single_select' || attribute.valueType === 'multi_select')
    return (
      <label>
        {attribute.label}
        <select
          name={`f.${attribute.id}`}
          defaultValue={
            attribute.valueType === 'multi_select'
              ? params.getAll(`f.${attribute.id}`)
              : (params.get(`f.${attribute.id}`) ?? '')
          }
          multiple={attribute.valueType === 'multi_select'}
        >
          <option value="">—</option>
          {attribute.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (attribute.valueType === 'boolean')
    return (
      <label>
        {attribute.label}
        <select name={`b.${attribute.id}`} defaultValue={params.get(`b.${attribute.id}`) ?? ''}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  if (['integer', 'decimal', 'measurement'].includes(attribute.valueType))
    return (
      <fieldset>
        <legend>
          {attribute.label}
          {attribute.unit ? ` (${attribute.unit})` : ''}
        </legend>
        <input
          aria-label="Minimum"
          name={`n.${attribute.id}.min`}
          type="number"
          step="any"
          defaultValue={params.get(`n.${attribute.id}.min`) ?? ''}
        />
        <input
          aria-label="Maximum"
          name={`n.${attribute.id}.max`}
          type="number"
          step="any"
          defaultValue={params.get(`n.${attribute.id}.max`) ?? ''}
        />
      </fieldset>
    );
  return null;
}

function SearchGrid({
  items,
  locale,
  fallback
}: {
  items: PublicListingCard[];
  locale: AppLocale;
  fallback: string;
}) {
  return (
    <div className="listing-grid">
      {items.map((item) => (
        <Link className="listing-card" href={`/${locale}/listings/${item.id}`} key={item.id}>
          <div
            className={item.mediaUrl ? 'listing-card-media has-photo' : 'listing-card-media'}
            style={
              item.mediaUrl ? {backgroundImage: `url(${JSON.stringify(item.mediaUrl)})`} : undefined
            }
          />
          <div className="listing-card-body">
            <strong className="listing-price">
              {formatPrice(item.priceMinor, item.currency, locale, fallback)}
            </strong>
            <h3>{item.title}</h3>
            <p>{item.categoryName}</p>
            <span>{item.locationName}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function flattenCategories(nodes: CategoryNodeContract[]): CategoryNodeContract[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}
function toUrlSearchParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(key, item);
  return params;
}
function pageHref(locale: AppLocale, current: URLSearchParams, page: number) {
  const params = new URLSearchParams(current);
  params.set('page', String(page));
  return `/${locale}/search?${params}`;
}
