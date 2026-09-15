import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {SiteHeader} from '@/components/site-header';
import {SaveSearchForm} from '@/modules/engagement/ui/save-search-form';
import type {AppLocale} from '@/i18n/routing';
import type {CategoryAttributeContract, CategoryNodeContract} from '@/modules/catalog/contracts';
import {getCategorySchema, listCategoryTree} from '@/modules/catalog/repository';
import {listFilterLocations} from '@/modules/geography/repository';
import type {PublicListingCard} from '@/modules/listings/public-listing-service';
import {formatPrice} from '@/modules/listings/ui/format';
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
        savedLabel={t('savedLink')}
        accountLabel={t('accountLink')}
      />
      <header className="search-hero">
        <div>
          <p className="eyebrow">SATAL SEARCH</p>
          <h1>{t('title')}</h1>
        </div>
        <form className="search-query-form" action={`/${locale}/search`} role="search">
          <label className="sr-only" htmlFor="search-query">
            {t('query')}
          </label>
          <span className="search-query-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
          <input
            id="search-query"
            name="q"
            defaultValue={query.q}
            placeholder={t('queryPlaceholder')}
          />
          <PreservedSearchInputs params={url} excluded={['q', 'page']} />
          <button className="button button-primary" type="submit">
            {t('searchAction')}
          </button>
        </form>
      </header>

      <div className="search-workspace">
        <aside className="search-sidebar">
          <section className="search-filter-panel">
            <header className="search-panel-heading">
              <div>
                <h2>{t('filtersTitle')}</h2>
                <p>{t('filtersHint')}</p>
              </div>
              <Link href={`/${locale}/search`}>{t('reset')}</Link>
            </header>
            <form className="search-filters" action={`/${locale}/search`}>
              {query.q && <input name="q" type="hidden" value={query.q} />}
              <label>
                <span>{t('category')}</span>
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
                <span>{t('location')}</span>
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
              <fieldset className="search-price-range">
                <legend>{t('priceRange')}</legend>
                <div>
                  <label>
                    <span>{t('priceMin')}</span>
                    <input
                      name="priceMin"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={
                        query.priceMinMinor === undefined ? '' : query.priceMinMinor / 100
                      }
                    />
                  </label>
                  <label>
                    <span>{t('priceMax')}</span>
                    <input
                      name="priceMax"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={
                        query.priceMaxMinor === undefined ? '' : query.priceMaxMinor / 100
                      }
                    />
                  </label>
                </div>
              </fieldset>
              <label>
                <span>{t('sort')}</span>
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
                  <DynamicFilter
                    key={attribute.id}
                    attribute={attribute}
                    params={url}
                    labels={{
                      any: t('anyValue'),
                      yes: t('yes'),
                      no: t('no'),
                      minimum: t('minimum'),
                      maximum: t('maximum')
                    }}
                  />
                ))}
              <button className="button button-primary search-filter-submit" type="submit">
                {t('apply')}
              </button>
            </form>
          </section>

          <section className="search-save-panel">
            <h2>{t('saveTitle')}</h2>
            <p>{t('saveHint')}</p>
            <SaveSearchForm
              locale={locale}
              query={url.toString()}
              labels={{
                name: t('saveName'),
                action: t('saveAction'),
                saved: t('saveSuccess'),
                auth: t('saveAuth'),
                error: t('saveError')
              }}
            />
          </section>
        </aside>

        <section className="search-results" aria-labelledby="search-results-title">
          <header className="search-results-heading">
            <div>
              <h2 id="search-results-title">{t('resultsTitle')}</h2>
              <p>{t('resultCount', {count: result.total})}</p>
            </div>
          </header>
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
        </section>
      </div>
    </main>
  );
}

function DynamicFilter({
  attribute,
  params,
  labels
}: {
  attribute: CategoryAttributeContract;
  params: URLSearchParams;
  labels: {any: string; yes: string; no: string; minimum: string; maximum: string};
}) {
  if (attribute.valueType === 'single_select' || attribute.valueType === 'multi_select')
    return (
      <label>
        <span>{attribute.label}</span>
        <select
          name={`f.${attribute.id}`}
          defaultValue={
            attribute.valueType === 'multi_select'
              ? params.getAll(`f.${attribute.id}`)
              : (params.get(`f.${attribute.id}`) ?? '')
          }
          multiple={attribute.valueType === 'multi_select'}
        >
          <option value="">{labels.any}</option>
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
        <span>{attribute.label}</span>
        <select name={`b.${attribute.id}`} defaultValue={params.get(`b.${attribute.id}`) ?? ''}>
          <option value="">{labels.any}</option>
          <option value="true">{labels.yes}</option>
          <option value="false">{labels.no}</option>
        </select>
      </label>
    );
  if (['integer', 'decimal', 'measurement'].includes(attribute.valueType))
    return (
      <fieldset className="search-dynamic-range">
        <legend>
          {attribute.label}
          {attribute.unit ? ` (${attribute.unit})` : ''}
        </legend>
        <div>
          <input
            aria-label={labels.minimum}
            name={`n.${attribute.id}.min`}
            type="number"
            step="any"
            placeholder={labels.minimum}
            defaultValue={params.get(`n.${attribute.id}.min`) ?? ''}
          />
          <input
            aria-label={labels.maximum}
            name={`n.${attribute.id}.max`}
            type="number"
            step="any"
            placeholder={labels.maximum}
            defaultValue={params.get(`n.${attribute.id}.max`) ?? ''}
          />
        </div>
      </fieldset>
    );
  return null;
}

function PreservedSearchInputs({params, excluded}: {params: URLSearchParams; excluded: string[]}) {
  return Array.from(params.entries())
    .filter(([key]) => !excluded.includes(key))
    .map(([key, value], index) => (
      <input key={`${key}:${value}:${index}`} name={key} type="hidden" value={value} />
    ));
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
    <div className="listing-grid search-listing-grid">
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
