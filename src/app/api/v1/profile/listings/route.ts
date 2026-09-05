import {NextResponse} from 'next/server';

import {parseQuery} from '@/modules/engagement/http';
import {ownerListingQuerySchema} from '@/modules/moderation/contracts';
import {listOwnListings} from '@/modules/moderation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, ownerListingQuerySchema);
    const response = NextResponse.json({
      data: await listOwnListings(getDatabase(), actorId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
