import {NextResponse} from 'next/server';

import {renameSavedSearchSchema} from '@/modules/engagement/contracts';
import {deleteSavedSearch, renameSavedSearch} from '@/modules/engagement/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{savedSearchId: string}>};

export async function PATCH(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const id = parseUuid((await context.params).savedSearchId, 'savedSearchId');
    const {name} = await parseJson(request, renameSavedSearchSchema);
    const response = NextResponse.json({
      data: await renameSavedSearch(getDatabase(), actorId, id, name)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const id = parseUuid((await context.params).savedSearchId, 'savedSearchId');
    const response = NextResponse.json({data: await deleteSavedSearch(getDatabase(), actorId, id)});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
