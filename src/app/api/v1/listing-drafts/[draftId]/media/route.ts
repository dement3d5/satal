import {NextResponse} from 'next/server';

import {arrangeDraftMediaSchema, authorizeMediaUploadSchema} from '@/modules/media/contracts';
import {
  arrangeDraftMedia,
  authorizeDraftMediaUpload,
  listDraftMedia
} from '@/modules/media/media-service';
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
    return privateJson(await listDraftMedia(getDatabase(), actorId, draftId));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const draftId = parseUuid((await context.params).draftId, 'draftId');
    const input = await parseJson(request, authorizeMediaUploadSchema);
    const response = privateJson(
      await authorizeDraftMediaUpload(getDatabase(), actorId, draftId, input),
      201
    );
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
    const input = await parseJson(request, arrangeDraftMediaSchema);
    return privateJson(await arrangeDraftMedia(getDatabase(), actorId, draftId, input));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function privateJson(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json({data}, {status});
  response.headers.set('cache-control', 'no-store');
  return response;
}
