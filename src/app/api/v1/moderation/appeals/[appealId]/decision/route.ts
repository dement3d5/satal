import {NextResponse} from 'next/server';

import {listingAppealDecisionSchema} from '@/modules/moderation/trust-contracts';
import {decideListingAppeal} from '@/modules/moderation/trust-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{appealId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const appealId = parseUuid((await context.params).appealId, 'appealId');
    const input = await parseJson(request, listingAppealDecisionSchema);
    const response = NextResponse.json({
      data: await decideListingAppeal(getDatabase(), actorId, appealId, input)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
