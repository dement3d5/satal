import {NextResponse} from 'next/server';

import {createDraftSchema} from '@/modules/listings/draft-contracts';
import {createListingDraft} from '@/modules/listings/draft-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const input = await parseJson(request, createDraftSchema);
    const response = NextResponse.json(
      {data: await createListingDraft(getDatabase(), actorId, input.categoryId)},
      {status: 201}
    );
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
