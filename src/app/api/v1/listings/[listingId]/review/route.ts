import {NextResponse} from 'next/server';

import {getOwnListingReview} from '@/modules/moderation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{listingId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const listingId = parseUuid((await context.params).listingId, 'listingId');
    const response = NextResponse.json({
      data: await getOwnListingReview(getDatabase(), actorId, listingId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
