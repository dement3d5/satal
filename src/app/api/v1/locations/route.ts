import {NextResponse} from 'next/server';

import {listLocations} from '@/modules/geography/repository';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseLocale, parseUuid} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const params = new URL(request.url).searchParams;
    const locale = parseLocale(params.get('locale'));
    const parent = params.get('parentId');
    const parentId = parent ? parseUuid(parent, 'parentId') : null;
    const response = NextResponse.json({
      data: await listLocations(getDatabase(), locale, parentId)
    });
    response.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
