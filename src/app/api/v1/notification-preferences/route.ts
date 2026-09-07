import {NextResponse} from 'next/server';

import {updateNotificationPreferencesSchema} from '@/modules/notifications/contracts';
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from '@/modules/notifications/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const response = NextResponse.json({
      data: await getNotificationPreferences(getDatabase(), actorId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const input = await parseJson(request, updateNotificationPreferencesSchema);
    const response = NextResponse.json({
      data: await updateNotificationPreferences(getDatabase(), actorId, input)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
