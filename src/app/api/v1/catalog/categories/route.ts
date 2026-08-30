import {NextResponse} from 'next/server';

import {listCategoryTree} from '@/modules/catalog/repository';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseLocale} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const locale = parseLocale(new URL(request.url).searchParams.get('locale'));
    const response = NextResponse.json({data: await listCategoryTree(getDatabase(), locale)});
    response.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
