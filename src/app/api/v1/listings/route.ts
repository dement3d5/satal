import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {publicListingQuerySchema} from '@/modules/listings/publication-contracts';
import {listPublicListings} from '@/modules/listings/public-listing-service';
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
    const query = publicListingQuerySchema.parse(Object.fromEntries(url.searchParams));
    const response = NextResponse.json({data: await listPublicListings(getDatabase(), locale, query)});
    response.headers.set('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
