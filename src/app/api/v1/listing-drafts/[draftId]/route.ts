import {NextResponse} from 'next/server';

import {autosaveDraftSchema} from '@/modules/listings/draft-contracts';
import {autosaveListingDraft, getListingDraft} from '@/modules/listings/draft-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{draftId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const draftId = parseUuid((await context.params).draftId, 'draftId');
    const response = NextResponse.json({
      data: await getListingDraft(getDatabase(), actorId, draftId)
    });
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const draftId = parseUuid((await context.params).draftId, 'draftId');
    const input = await parseJson(request, autosaveDraftSchema);
    const response = NextResponse.json({
      data: await autosaveListingDraft(getDatabase(), actorId, draftId, input)
    });
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
