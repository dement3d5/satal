import type {AppLocale} from '@/i18n/routing';

import type {SearchQuery} from './contracts';

export interface SearchPage {
  ids: string[];
  total: number;
}

export interface SearchGateway {
  search(locale: AppLocale, query: SearchQuery): Promise<SearchPage>;
  upsert(document: SearchDocument): Promise<void>;
  remove(listingId: string): Promise<void>;
  rebuild(documents: AsyncIterable<SearchDocument>): Promise<number>;
}

export interface SearchDocument {
  id: string;
  version: number;
  title: string;
  description: string;
  categoryId: string;
  categoryAncestors: string[];
  locationId: string;
  locationAncestors: string[];
  priceMinor: number | null;
  publishedAt: number;
  searchTextAz: string;
  searchTextRu: string;
  searchTextEn: string;
  facetTokens: string[];
  numericFacets: Record<string, number>;
}
