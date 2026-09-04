import {NextResponse} from 'next/server';

import {updateProfileSchema} from '@/modules/identity/contracts';
import {getOwnProfile, updateOwnProfile} from '@/modules/identity/profile-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const response = NextResponse.json({data: await getOwnProfile(getDatabase(), actorId)});
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
    const input = await parseJson(request, updateProfileSchema);
    const response = NextResponse.json({
      data: await updateOwnProfile(getDatabase(), actorId, input.name)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
