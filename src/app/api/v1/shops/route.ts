import {NextResponse} from 'next/server';

import {createShopSchema} from '@/modules/shops/contracts';
import {createShop, listMyShops} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    return privateJson(await listMyShops(getDatabase(), actorId));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const input = await parseJson(request, createShopSchema);
    return privateJson(await createShop(getDatabase(), actorId, input), 201);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function privateJson(data: unknown, status = 200) {
  const response = NextResponse.json({data}, {status});
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
