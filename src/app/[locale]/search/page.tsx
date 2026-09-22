import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {SiteHeader} from '@/components/site-header';
import type {AppLocale} from '@/i18n/routing';
import type {CategoryAttributeContract, CategoryNodeContract} from '@/modules/catalog/contracts';
import {getCategorySchema, listCategoryTree} from '@/modules/catalog/repository';
import {SaveSearchForm} from '@/modules/engagement/ui/save-search-form';
import type {LocationContract} from '@/modules/geography/contracts';
import {listFilterLocations} from '@/modules/geography/repository';
import type {PublicListingCard} from '@/modules/listings/public-listing-service';
import {MarketplaceListingCard} from '@/modules/listings/ui/marketplace-listing-card';
import {parseSearchParams} from '@/modules/search/contracts';
import {searchListings} from '@/modules/search/search-service';
import {getDatabase} from '@/server/db/client';

const launchCategorySlugs = ['apartments-for-sale', 'passenger-cars'] as const;

export default async function SearchPage({
  params,
  searchParams
}: {
  params: Promise<{locale: AppLocale}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{locale}, raw, t] = await Promise.all([params, searchParams, getTranslations('search')]);
  const db = getDatabase();
  const [categoryTree, locations] = await Promise.all([
    listCategoryTree(db, locale),
    listFilterLocations(db, locale)
  ]);
  const categories = flattenCategories(categoryTree);
  const searchModes = launchCategorySlugs
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter((category): category is CategoryNodeContract => Boolean(category));
  const url = toUrlSearchParams(raw);
  const requestedCategoryId = url.get('categoryId');
  const activeCategory =
    searchModes.find((category) => category.id === requestedCategoryId) ?? searchModes[0];
  if (activeCategory) {
    if (requestedCategoryId !== activeCategory.id) removeDynamicFilters(url);
    url.set('categoryId', activeCategory.id);
  }

  const baku = locations.find((location) => location.slug === 'baku');
  const requestedLocation = locations.find((location) => location.id === url.get('locationId'));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  if (baku && (!requestedLocation || !isLocationWithin(requestedLocation, baku.id, locationById)))
    url.set('locationId', baku.id);
  const activeLocation = locations.find((location) => location.id === url.get('locationId'));

  const query = parseSearchParams(url);
  const [result, schema] = await Promise.all([
    searchListings(db, locale, query),
    activeCategory ? getCategorySchema(db, activeCategory.id, locale) : null
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const filterableAttributes =
    schema?.attributes.filter(
      (attribute) => attribute.filterable && attribute.valueType !== 'text'
    ) ?? [];
  const quickAttributes = filterableAttributes.slice(0, 3);
  const moreAttributes = filterableAttributes.slice(3);
  const scopedLocations = baku
    ? locations.filter((location) => isLocationWithin(location, baku.id, locationById))
    : [];

  return (
    <main className="page-shell search-page search-market-page">
      <SiteHeader
        locale={locale}
        languageLabel={t('languageNavigation')}
        sellLabel={t('sellAction')}
        savedLabel={t('savedLink')}
        accountLabel={t('accountLink')}
      />

      <header className="search-market-header">
        <div className="search-market-intro">
          <h1 className="sr-only">{t('marketTitle')}</h1>
          <nav className="search-mode-tabs" aria-label={t('categoryMode')}>
            {searchModes.map((category) => (
              <Link
                aria-current={category.id === activeCategory?.id ? 'page' : undefined}
                className={category.id === activeCategory?.id ? 'is-active' : undefined}
                href={categoryHref(locale, url, category.id)}
                key={category.id}
              >
                <span aria-hidden="true">
                  {category.slug === 'apartments-for-sale' ? <ApartmentIcon /> : <CarIcon />}
                </span>
                {category.name}
              </Link>
            ))}
          </nav>
        </div>

        <form className="search-market-form" action={`/${locale}/search`} role="search">
          {activeCategory && <input name="categoryId" type="hidden" value={activeCategory.id} />}
          <div className="search-market-query">
            <label className="sr-only" htmlFor="search-query">
              {t('query')}
            </label>
            <SearchIcon />
            <input
              id="search-query"
              name="q"
              defaultValue={query.q}
              placeholder={
                activeCategory?.slug === 'passenger-cars'
                  ? t('carQueryPlaceholder')
                  : t('apartmentQueryPlaceholder')
              }
            />
            <button type="submit" aria-label={t('searchAction')}>
              <SearchIcon />
              <span>{t('searchAction')}</span>
            </button>
          </div>

          <div className="search-filter-bar">
            <FilterMenu
              label={t('location')}
              summary={activeLocation?.name ?? baku?.name ?? t('baku')}
            >
              <label className="search-filter-field">
                <span>{t('bakuArea')}</span>
                <select name="locationId" defaultValue={query.locationId ?? baku?.id ?? ''}>
                  {scopedLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {'— '.repeat(Math.max(0, location.depth - (baku?.depth ?? 1)))}
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </FilterMenu>

            <FilterMenu label={t('priceRange')} summary={priceSummary(query, t('anyValue'))}>
              <RangeFields
                maxName="priceMax"
                maxValue={
                  query.priceMaxMinor === undefined ? '' : String(query.priceMaxMinor / 100)
                }
                minName="priceMin"
                minValue={
                  query.priceMinMinor === undefined ? '' : String(query.priceMinMinor / 100)
                }
                labels={{minimum: t('priceMin'), maximum: t('priceMax')}}
              />
            </FilterMenu>

            {quickAttributes.map((attribute) => (
              <FilterMenu
                key={attribute.id}
                label={attribute.label}
                summary={dynamicFilterSummary(attribute, url, {
                  any: t('anyValue'),
                  yes: t('yes'),
                  no: t('no'),
                  selected: (count) => t('selectedCount', {count})
                })}
              >
                <DynamicFilterFields
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
              </FilterMenu>
            ))}

            {moreAttributes.length > 0 && (
              <details className="search-filter-menu search-more-filters">
                <summary>
                  <span>
                    <small>{t('moreFilters')}</small>
                    <strong>{t('moreFiltersHint', {count: moreAttributes.length})}</strong>
                  </span>
                  <ChevronIcon />
                </summary>
                <div className="search-filter-popover search-more-popover">
                  <header>
                    <div>
                      <strong>{t('moreFilters')}</strong>
                      <span>{activeCategory?.name}</span>
                    </div>
                    <Link href={categoryHref(locale, new URLSearchParams(), activeCategory!.id)}>
                      {t('reset')}
                    </Link>
                  </header>
                  <div className="search-more-grid">
                    {moreAttributes.map((attribute) => (
                      <fieldset key={attribute.id} className="search-advanced-filter">
                        <legend>{attribute.label}</legend>
                        <DynamicFilterFields
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
                      </fieldset>
                    ))}
                  </div>
                  <button className="button button-primary search-more-submit" type="submit">
                    {t('showResults', {count: result.total})}
                  </button>
                </div>
              </details>
            )}

            <label className="search-sort-control">
              <span className="sr-only">{t('sort')}</span>
              <SortIcon />
              <select name="sort" defaultValue={query.sort}>
                <option value="relevance">{t('relevance')}</option>
                <option value="newest">{t('newest')}</option>
                <option value="price_asc">{t('priceAsc')}</option>
                <option value="price_desc">{t('priceDesc')}</option>
              </select>
            </label>

            <button className="button button-primary search-filter-submit" type="submit">
              {t('showResults', {count: result.total})}
            </button>
            <Link
              className="search-reset-link"
              href={resetHref(locale, activeCategory?.id, baku?.id)}
            >
              {t('reset')}
            </Link>
          </div>
        </form>
      </header>

      <section
        className="search-results search-market-results"
        aria-labelledby="search-results-title"
      >
        <header className="search-results-heading">
          <div>
            <p>{activeCategory?.name}</p>
            <h2 id="search-results-title">{t('resultCount', {count: result.total})}</h2>
          </div>
          <details className="search-save-menu">
            <summary>{t('saveTitle')}</summary>
            <div className="search-save-panel search-save-popover">
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
            </div>
          </details>
        </header>
        {result.degraded && <p className="search-notice">{t('degraded')}</p>}
        {result.items.length ? (
          <SearchGrid
            items={result.items}
            locale={locale}
            labels={{priceOnRequest: t('priceOnRequest'), yes: t('yes'), no: t('no')}}
          />
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
    </main>
  );
}

function FilterMenu({
  label,
  summary,
  children
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="search-filter-menu">
      <summary>
        <span>
          <small>{label}</small>
          <strong>{summary}</strong>
        </span>
        <ChevronIcon />
      </summary>
      <div className="search-filter-popover">{children}</div>
    </details>
  );
}

function DynamicFilterFields({
  attribute,
  params,
  labels
}: {
  attribute: CategoryAttributeContract;
  params: URLSearchParams;
  labels: {any: string; yes: string; no: string; minimum: string; maximum: string};
}) {
  if (attribute.valueType === 'single_select')
    return (
      <label className="search-filter-field">
        <span className="sr-only">{attribute.label}</span>
        <select name={`f.${attribute.id}`} defaultValue={params.get(`f.${attribute.id}`) ?? ''}>
          <option value="">{labels.any}</option>
          {attribute.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (attribute.valueType === 'multi_select') {
    const selected = new Set(params.getAll(`f.${attribute.id}`));
    return (
      <div className="search-choice-grid">
        {attribute.options.map((option) => (
          <label key={option.id}>
            <input
              defaultChecked={selected.has(option.id)}
              name={`f.${attribute.id}`}
              type="checkbox"
              value={option.id}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (attribute.valueType === 'boolean')
    return (
      <label className="search-filter-field">
        <span className="sr-only">{attribute.label}</span>
        <select name={`b.${attribute.id}`} defaultValue={params.get(`b.${attribute.id}`) ?? ''}>
          <option value="">{labels.any}</option>
          <option value="true">{labels.yes}</option>
          <option value="false">{labels.no}</option>
        </select>
      </label>
    );
  if (['integer', 'decimal', 'measurement'].includes(attribute.valueType))
    return (
      <RangeFields
        max={attribute.constraints.maxNumeric ?? undefined}
        maxName={`n.${attribute.id}.max`}
        maxValue={params.get(`n.${attribute.id}.max`) ?? ''}
        min={attribute.constraints.minNumeric ?? undefined}
        minName={`n.${attribute.id}.min`}
        minValue={params.get(`n.${attribute.id}.min`) ?? ''}
        unit={attribute.unit}
        labels={{minimum: labels.minimum, maximum: labels.maximum}}
      />
    );
  return null;
}

function RangeFields({
  minName,
  maxName,
  minValue,
  maxValue,
  min,
  max,
  unit,
  labels
}: {
  minName: string;
  maxName: string;
  minValue: string;
  maxValue: string;
  min?: number | undefined;
  max?: number | undefined;
  unit?: string | null;
  labels: {minimum: string; maximum: string};
}) {
  return (
    <div className="search-range-fields">
      <label>
        <span>{labels.minimum}</span>
        <input
          name={minName}
          type="number"
          min={min}
          max={max}
          step="any"
          defaultValue={minValue}
        />
      </label>
      <label>
        <span>{labels.maximum}</span>
        <input
          name={maxName}
          type="number"
          min={min}
          max={max}
          step="any"
          defaultValue={maxValue}
        />
      </label>
      {unit && <small>{unit}</small>}
    </div>
  );
}

function SearchGrid({
  items,
  locale,
  labels
}: {
  items: PublicListingCard[];
  locale: AppLocale;
  labels: {priceOnRequest: string; yes: string; no: string};
}) {
  return (
    <div className="search-market-grid">
      {items.map((item, index) => (
        <MarketplaceListingCard
          item={item}
          key={item.id}
          labels={labels}
          locale={locale}
          priority={index < 4}
        />
      ))}
    </div>
  );
}

function priceSummary(query: ReturnType<typeof parseSearchParams>, fallback: string): string {
  if (query.priceMinMinor === undefined && query.priceMaxMinor === undefined) return fallback;
  const min = query.priceMinMinor === undefined ? '0' : String(query.priceMinMinor / 100);
  const max = query.priceMaxMinor === undefined ? '∞' : String(query.priceMaxMinor / 100);
  return `${min}–${max} AZN`;
}

function dynamicFilterSummary(
  attribute: CategoryAttributeContract,
  params: URLSearchParams,
  labels: {any: string; yes: string; no: string; selected: (count: number) => string}
): string {
  if (attribute.valueType === 'single_select' || attribute.valueType === 'multi_select') {
    const values = params.getAll(`f.${attribute.id}`).filter(Boolean);
    if (!values.length) return labels.any;
    const selected = attribute.options.filter((option) => values.includes(option.id));
    return selected.length === 1 ? selected[0]!.label : labels.selected(selected.length);
  }
  if (attribute.valueType === 'boolean') {
    const value = params.get(`b.${attribute.id}`);
    return value === 'true' ? labels.yes : value === 'false' ? labels.no : labels.any;
  }
  const min = params.get(`n.${attribute.id}.min`);
  const max = params.get(`n.${attribute.id}.max`);
  if (!min && !max) return labels.any;
  return `${min || '0'}–${max || '∞'}${attribute.unit ? ` ${attribute.unit}` : ''}`;
}

function flattenCategories(nodes: CategoryNodeContract[]): CategoryNodeContract[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

function isLocationWithin(
  location: LocationContract,
  scopeId: string,
  locations: Map<string, LocationContract>
): boolean {
  let current: LocationContract | undefined = location;
  while (current) {
    if (current.id === scopeId) return true;
    current = current.parentId ? locations.get(current.parentId) : undefined;
  }
  return false;
}

function removeDynamicFilters(params: URLSearchParams) {
  for (const key of [...params.keys()])
    if (key.startsWith('f.') || key.startsWith('b.') || key.startsWith('n.') || key === 'page')
      params.delete(key);
}

function categoryHref(locale: AppLocale, current: URLSearchParams, categoryId: string): string {
  const params = new URLSearchParams(current);
  removeDynamicFilters(params);
  params.set('categoryId', categoryId);
  return `/${locale}/search?${params}`;
}

function resetHref(locale: AppLocale, categoryId?: string, locationId?: string): string {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (locationId) params.set('locationId', locationId);
  return `/${locale}/search?${params}`;
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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h12M4 12h8M4 17h4" />
    </svg>
  );
}

function ApartmentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 21V5l10-2v18M15 9h4v12M3 21h18M9 7v1M9 12v1M9 17v1" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 11 2-5h10l2 5M4 11h16v6H4zM7 17v2M17 17v2M7 14h.01M17 14h.01" />
    </svg>
  );
}
