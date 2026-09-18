import {NextResponse} from 'next/server';

import {updateShopSchema} from '@/modules/shops/contracts';
import {getManagedShop, updateShop} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{shopId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const shopId = parseUuid((await context.params).shopId, 'shopId');
    return privateJson(await getManagedShop(getDatabase(), actorId, shopId));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const shopId = parseUuid((await context.params).shopId, 'shopId');
    const input = await parseJson(request, updateShopSchema);
    return privateJson(await updateShop(getDatabase(), actorId, shopId, input));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function privateJson(data: unknown) {
  const response = NextResponse.json({data});
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
