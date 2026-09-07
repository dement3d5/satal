import {NextResponse} from 'next/server';

import {createReviewSchema} from '@/modules/reputation/contracts';
import {createInteractionReview} from '@/modules/reputation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{interactionId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const interactionId = parseUuid((await context.params).interactionId, 'interactionId');
    const input = await parseJson(request, createReviewSchema);
    const data = await createInteractionReview(getDatabase(), actorId, interactionId, input);
    const response = NextResponse.json({data}, {status: data.created ? 201 : 200});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
