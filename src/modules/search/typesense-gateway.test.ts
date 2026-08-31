import {describe, expect, it, vi} from 'vitest';

import {TypesenseSearchGateway} from './typesense-gateway';

const query = {
  q: 'camry',
  categoryId: '11111111-1111-4111-8111-111111111111',
  sort: 'price_asc' as const,
  page: 2,
  limit: 24,
  filters: []
};

describe('TypesenseSearchGateway', () => {
  it('builds a localized, faceted search request and returns ordered ids', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({found: 2, hits: [{document: {id: 'one'}}, {document: {id: 'two'}}]})
        )
      );
    const gateway = new TypesenseSearchGateway('https://typesense.test/', 'secret-key', fetcher);
    await expect(gateway.search('ru', query)).resolves.toEqual({ids: ['one', 'two'], total: 2});
    const [request, init] = fetcher.mock.calls[0]!;
    const url = new URL(String(request));
    expect(url.pathname).toBe('/collections/satal_listings/documents/search');
    expect(url.searchParams.get('query_by')).toBe('title,searchTextRu');
    expect(url.searchParams.get('filter_by')).toContain(query.categoryId);
    expect(url.searchParams.get('sort_by')).toBe('priceMinor:asc,publishedAt:desc');
    expect(new Headers(init?.headers).get('x-typesense-api-key')).toBe('secret-key');
  });

  it('checks every JSONL import result even when HTTP succeeds', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"success":false,"error":"bad document"}', {status: 200}));
    const gateway = new TypesenseSearchGateway('https://typesense.test', 'secret-key', fetcher);
    await expect(
      gateway.upsert({
        id: 'one',
        version: 1,
        title: 'Title',
        description: 'Description',
        categoryId: 'category',
        categoryAncestors: ['category'],
        locationId: 'location',
        locationAncestors: ['location'],
        priceMinor: 10,
        publishedAt: 1,
        searchTextAz: 'Title',
        searchTextRu: 'Title',
        searchTextEn: 'Title',
        facetTokens: [],
        numericFacets: {}
      })
    ).rejects.toMatchObject({code: 'SERVICE_UNAVAILABLE'});
  });
});
