import {NextResponse} from 'next/server';

import {changeDraftCategorySchema} from '@/modules/listings/draft-contracts';
import {changeListingDraftCategory} from '@/modules/listings/draft-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function PUT(request: Request, context: {params: Promise<{draftId: string}>}) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const draftId = parseUuid((await context.params).draftId, 'draftId');
    const input = await parseJson(request, changeDraftCategorySchema);
    const response = NextResponse.json({
      data: await changeListingDraftCategory(getDatabase(), actorId, draftId, input)
    });
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
