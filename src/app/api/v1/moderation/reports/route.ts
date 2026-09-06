import {NextResponse} from 'next/server';

import {trustQueueQuerySchema} from '@/modules/moderation/trust-contracts';
import {listModerationReports} from '@/modules/moderation/trust-service';
import {parseQuery} from '@/modules/engagement/http';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, trustQueueQuerySchema);
    const response = NextResponse.json({
      data: await listModerationReports(getDatabase(), actorId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
