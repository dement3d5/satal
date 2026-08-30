import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {getPublicListing} from '@/modules/listings/public-listing-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

type Context = {params: Promise<{listingId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const url = new URL(request.url);
    const requestedLocale = url.searchParams.get('locale') ?? routing.defaultLocale;
    const locale = routing.locales.includes(requestedLocale as (typeof routing.locales)[number])
      ? (requestedLocale as (typeof routing.locales)[number])
      : routing.defaultLocale;
    const listingId = parseUuid((await context.params).listingId, 'listingId');
    const response = NextResponse.json({
      data: await getPublicListing(getDatabase(), locale, listingId)
    });
    response.headers.set('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
