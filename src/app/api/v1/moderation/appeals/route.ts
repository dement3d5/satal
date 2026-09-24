import {NextResponse} from 'next/server';

import {parseQuery} from '@/modules/engagement/http';
import {trustQueueQuerySchema} from '@/modules/moderation/trust-contracts';
import {listModerationAppeals} from '@/modules/moderation/trust-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, trustQueueQuerySchema);
    const queue = await listModerationAppeals(getDatabase(), actorId, query);
    const response = NextResponse.json({
      data: queue.items,
      meta: {excludedConflictCount: queue.excludedConflictCount}
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
