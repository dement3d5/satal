import {NextResponse} from 'next/server';

import {decideShopVerificationSchema} from '@/modules/shops/contracts';
import {decideShopVerification} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{requestId: string}>};

export async function POST(request: Request, context: Context) {
  const requestIdHeader = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const requestId = parseUuid((await context.params).requestId, 'requestId');
    const input = await parseJson(request, decideShopVerificationSchema);
    const response = NextResponse.json({
      data: await decideShopVerification(getDatabase(), actorId, requestId, input)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestIdHeader);
  }
}
