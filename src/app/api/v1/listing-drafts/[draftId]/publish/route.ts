import {NextResponse} from 'next/server';

import {publishListingSchema} from '@/modules/listings/publication-contracts';
import {publishListingDraft} from '@/modules/listings/publication-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{draftId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const draftId = parseUuid((await context.params).draftId, 'draftId');
    const input = await parseJson(request, publishListingSchema);
    const response = NextResponse.json(
      {data: await publishListingDraft(getDatabase(), actorId, draftId, input)},
      {status: 201}
    );
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
