import {NextResponse} from 'next/server';

import {getPublicShop} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseLocale} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

type Context = {params: Promise<{slug: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const locale = parseLocale(new URL(request.url).searchParams.get('locale'));
    const slug = (await context.params).slug;
    const response = NextResponse.json({data: await getPublicShop(getDatabase(), locale, slug)});
    response.headers.set('cache-control', 'public, max-age=30, s-maxage=120');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
