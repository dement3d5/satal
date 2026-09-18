import {NextResponse} from 'next/server';

import {submitShopVerificationSchema} from '@/modules/shops/contracts';
import {submitShopVerification} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{shopId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const shopId = parseUuid((await context.params).shopId, 'shopId');
    const input = await parseJson(request, submitShopVerificationSchema);
    const response = NextResponse.json(
      {data: await submitShopVerification(getDatabase(), actorId, shopId, input)},
      {status: 201}
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
