import {NextResponse} from 'next/server';

import {parseQuery} from '@/modules/engagement/http';
import {moderationOperationsQuerySchema} from '@/modules/moderation/contracts';
import {getModerationOperations} from '@/modules/moderation/operations-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, moderationOperationsQuerySchema);
    const response = NextResponse.json({
      data: await getModerationOperations(getDatabase(), actorId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
