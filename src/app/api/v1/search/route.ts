import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {parseSearchParams} from '@/modules/search/contracts';
import {searchListings} from '@/modules/search/search-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const url = new URL(request.url);
    const requestedLocale = url.searchParams.get('locale') ?? routing.defaultLocale;
    const locale = routing.locales.includes(requestedLocale as (typeof routing.locales)[number])
      ? (requestedLocale as (typeof routing.locales)[number])
      : routing.defaultLocale;
    const data = await searchListings(getDatabase(), locale, parseSearchParams(url.searchParams));
    const response = NextResponse.json({data});
    response.headers.set('cache-control', 'public, s-maxage=15, stale-while-revalidate=60');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
