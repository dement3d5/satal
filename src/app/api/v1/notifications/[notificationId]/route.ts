import {NextResponse} from 'next/server';

import {updateNotificationSchema} from '@/modules/notifications/contracts';
import {markNotificationRead} from '@/modules/notifications/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{notificationId: string}>};

export async function PATCH(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const notificationId = parseUuid((await context.params).notificationId, 'notificationId');
    await parseJson(request, updateNotificationSchema);
    const response = NextResponse.json({
      data: await markNotificationRead(getDatabase(), actorId, notificationId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
