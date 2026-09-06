import {NextResponse} from 'next/server';

import {createListingAppealSchema} from '@/modules/moderation/trust-contracts';
import {createListingAppeal, getOwnListingAppeal} from '@/modules/moderation/trust-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{listingId: string}>};

export async function GET(request: Request, context: Context) {
  return handle(request, context, 'get');
}

export async function POST(request: Request, context: Context) {
  return handle(request, context, 'post');
}

async function handle(request: Request, context: Context, action: 'get' | 'post') {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const listingId = parseUuid((await context.params).listingId, 'listingId');
    const data =
      action === 'post'
        ? await createListingAppeal(
            getDatabase(),
            actorId,
            listingId,
            await parseJson(request, createListingAppealSchema)
          )
        : await getOwnListingAppeal(getDatabase(), actorId, listingId);
    const response = NextResponse.json(
      {data},
      {status: action === 'post' && 'created' in data && data.created ? 201 : 200}
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
