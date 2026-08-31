import {NextResponse} from 'next/server';

import {removeDraftMedia} from '@/modules/media/media-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{draftId: string; assetId: string}>};

export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    await removeDraftMedia(
      getDatabase(),
      actorId,
      parseUuid(params.draftId, 'draftId'),
      parseUuid(params.assetId, 'assetId')
    );
    return new NextResponse(null, {status: 204, headers: {'cache-control': 'no-store'}});
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
