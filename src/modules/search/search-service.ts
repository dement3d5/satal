import {getServerEnvironment} from '@/config/env';
import type {AppLocale} from '@/i18n/routing';
import {
  getPublicListingCardsByIds,
  type PublicListingCard
} from '@/modules/listings/public-listing-service';
import type {DatabaseClient} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';

import type {SearchQuery} from './contracts';
import {validateDynamicFilters} from './filter-validation';
import type {SearchGateway} from './gateway';
import {searchPostgres} from './postgres-search';
import {TypesenseSearchGateway} from './typesense-gateway';

export interface SearchResponse {
  items: PublicListingCard[];
  total: number;
  page: number;
  limit: number;
  source: 'postgres' | 'typesense';
  degraded: boolean;
}

export async function searchListings(
  db: DatabaseClient,
  locale: AppLocale,
  query: SearchQuery,
  gateway?: SearchGateway
): Promise<SearchResponse> {
  await validateDynamicFilters(db, query.categoryId, query.filters);
  const environment = getServerEnvironment();
  if (environment.SEARCH_PROVIDER === 'typesense') {
    const typesense =
      gateway ??
      new TypesenseSearchGateway(environment.TYPESENSE_URL!, environment.TYPESENSE_API_KEY!);
    try {
      const page = await typesense.search(locale, query);
      return {
        items: await getPublicListingCardsByIds(db, locale, page.ids),
        total: page.total,
        page: query.page,
        limit: query.limit,
        source: 'typesense',
        degraded: false
      };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'SERVICE_UNAVAILABLE') throw error;
    }
  }

  const page = await searchPostgres(db, query);
  return {
    items: await getPublicListingCardsByIds(db, locale, page.ids),
    total: page.total,
    page: query.page,
    limit: query.limit,
    source: 'postgres',
    degraded: environment.SEARCH_PROVIDER === 'typesense'
  };
}

export function configuredSearchGateway(): SearchGateway {
  const environment = getServerEnvironment();
  if (environment.SEARCH_PROVIDER !== 'typesense') {
    throw new AppError('SERVICE_UNAVAILABLE', 'Typesense indexing is not configured', 503);
  }
  return new TypesenseSearchGateway(environment.TYPESENSE_URL!, environment.TYPESENSE_API_KEY!);
}
