import {NextResponse} from 'next/server';

import {favoriteListQuerySchema} from '@/modules/engagement/contracts';
import {parseQuery} from '@/modules/engagement/http';
import {listFavorites} from '@/modules/engagement/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const {locale} = parseQuery(request, favoriteListQuerySchema);
    const response = NextResponse.json({data: await listFavorites(getDatabase(), actorId, locale)});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
