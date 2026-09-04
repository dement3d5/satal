import {NextResponse} from 'next/server';

import {createSavedSearchSchema, savedSearchListQuerySchema} from '@/modules/engagement/contracts';
import {parseQuery} from '@/modules/engagement/http';
import {createSavedSearch, listSavedSearches} from '@/modules/engagement/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const {locale} = parseQuery(request, savedSearchListQuerySchema);
    const response = NextResponse.json({
      data: await listSavedSearches(getDatabase(), actorId, locale)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const input = await parseJson(request, createSavedSearchSchema);
    const response = NextResponse.json(
      {data: await createSavedSearch(getDatabase(), actorId, input)},
      {status: 201}
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
