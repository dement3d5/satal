import type {AppLocale} from '@/i18n/routing';
import {AppError} from '@/server/errors/app-error';

import type {SearchQuery} from './contracts';
import type {SearchDocument, SearchGateway, SearchPage} from './gateway';
import {facetToken, numericFacetKey} from './projection';

const alias = 'satal_listings';

export class TypesenseSearchGateway implements SearchGateway {
  private readonly baseUrl: string;

  constructor(
    url: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  async search(locale: AppLocale, query: SearchQuery): Promise<SearchPage> {
    const parameters = new URLSearchParams({
      q: query.q || '*',
      query_by: `title,searchText${locale[0]!.toUpperCase()}${locale.slice(1)}`,
      page: String(query.page),
      per_page: String(query.limit),
      include_fields: 'id'
    });
    const filters = buildFilters(query);
    if (filters.length) parameters.set('filter_by', filters.join(' && '));
    const sort = typesenseSort(query.sort);
    if (sort) parameters.set('sort_by', sort);

    const result = await this.request<{found: number; hits?: Array<{document: {id: string}}>}>(
      `/collections/${alias}/documents/search?${parameters}`
    );
    return {ids: (result.hits ?? []).map((hit) => hit.document.id), total: result.found};
  }

  async upsert(document: SearchDocument): Promise<void> {
    await this.importDocuments(alias, [document]);
  }

  async remove(listingId: string): Promise<void> {
    await this.request(
      `/collections/${alias}/documents/${encodeURIComponent(listingId)}?ignore_not_found=true`,
      {
        method: 'DELETE'
      }
    );
  }

  async rebuild(documents: AsyncIterable<SearchDocument>): Promise<number> {
    const collection = `satal_listings_${Date.now()}`;
    await this.request('/collections', {
      method: 'POST',
      body: JSON.stringify(collectionSchema(collection))
    });
    let count = 0;
    let batch: SearchDocument[] = [];
    for await (const document of documents) {
      batch.push(document);
      if (batch.length === 100) {
        await this.importDocuments(collection, batch);
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await this.importDocuments(collection, batch);
      count += batch.length;
    }
    await this.request(`/aliases/${alias}`, {
      method: 'PUT',
      body: JSON.stringify({collection_name: collection})
    });
    return count;
  }

  private async importDocuments(collection: string, documents: SearchDocument[]): Promise<void> {
    const response = await this.requestText(
      `/collections/${collection}/documents/import?action=upsert`,
      {method: 'POST', body: documents.map((item) => JSON.stringify(item)).join('\n')},
      'text/plain'
    );
    const results = response
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as {success: boolean});
    if (results.length !== documents.length || results.some((result) => !result.success)) {
      throw unavailable();
    }
  }

  private async request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.requestText(path, init, 'application/json');
    return response ? (JSON.parse(response) as T) : (undefined as T);
  }

  private async requestText(
    path: string,
    init?: RequestInit,
    contentType?: string
  ): Promise<string> {
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'content-type': contentType ?? 'application/json',
          'x-typesense-api-key': this.apiKey,
          ...init?.headers
        },
        signal: AbortSignal.timeout(3_000)
      });
      if (!response.ok) throw unavailable();
      return await response.text();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailable(error);
    }
  }
}

function buildFilters(query: SearchQuery): string[] {
  const filters: string[] = [];
  if (query.categoryId) filters.push(`categoryAncestors:=${query.categoryId}`);
  if (query.locationId) filters.push(`locationAncestors:=${query.locationId}`);
  if (query.priceMinMinor !== undefined) filters.push(`priceMinor:>=${query.priceMinMinor}`);
  if (query.priceMaxMinor !== undefined) filters.push(`priceMinor:<=${query.priceMaxMinor}`);
  for (const filter of query.filters) {
    if (filter.type === 'options') {
      filters.push(
        `facetTokens:=[${filter.optionIds.map((id) => facetToken(filter.attributeId, id)).join(',')}]`
      );
    } else if (filter.type === 'boolean') {
      filters.push(`facetTokens:=${facetToken(filter.attributeId, String(filter.value))}`);
    } else {
      const field = `numericFacets.${numericFacetKey(filter.attributeId)}`;
      if (filter.min !== undefined) filters.push(`${field}:>=${filter.min}`);
      if (filter.max !== undefined) filters.push(`${field}:<=${filter.max}`);
    }
  }
  return filters;
}

function typesenseSort(sort: SearchQuery['sort']): string | undefined {
  if (sort === 'newest') return 'publishedAt:desc';
  if (sort === 'price_asc') return 'priceMinor:asc,publishedAt:desc';
  if (sort === 'price_desc') return 'priceMinor:desc,publishedAt:desc';
  return undefined;
}

function collectionSchema(name: string) {
  return {
    name,
    enable_nested_fields: true,
    fields: [
      {name: 'title', type: 'string'},
      {name: 'description', type: 'string'},
      {name: 'searchTextAz', type: 'string'},
      {name: 'searchTextRu', type: 'string'},
      {name: 'searchTextEn', type: 'string'},
      {name: 'categoryId', type: 'string', facet: true},
      {name: 'categoryAncestors', type: 'string[]', facet: true},
      {name: 'locationId', type: 'string', facet: true},
      {name: 'locationAncestors', type: 'string[]', facet: true},
      {name: 'priceMinor', type: 'int64', optional: true, sort: true},
      {name: 'publishedAt', type: 'int64', sort: true},
      {name: 'facetTokens', type: 'string[]', facet: true},
      {name: 'numericFacets', type: 'object', optional: true},
      {name: 'numericFacets.*', type: 'float', facet: true, optional: true}
    ],
    default_sorting_field: 'publishedAt'
  };
}

function unavailable(cause?: unknown): AppError {
  return new AppError('SERVICE_UNAVAILABLE', 'Search is temporarily unavailable', 503, {cause});
}
