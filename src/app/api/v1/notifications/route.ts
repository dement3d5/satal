import {NextResponse} from 'next/server';

import {notificationListQuerySchema} from '@/modules/notifications/contracts';
import {listNotifications} from '@/modules/notifications/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseQuery} from '@/server/http/query';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, notificationListQuerySchema);
    const response = NextResponse.json({
      data: await listNotifications(getDatabase(), actorId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
