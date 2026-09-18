import {NextResponse} from 'next/server';

import {addShopMemberSchema} from '@/modules/shops/contracts';
import {addShopMember, listShopMembers} from '@/modules/shops/service';
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
    return privateJson(await listShopMembers(getDatabase(), actorId, shopId));
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const shopId = parseUuid((await context.params).shopId, 'shopId');
    const input = await parseJson(request, addShopMemberSchema);
    return privateJson(await addShopMember(getDatabase(), actorId, shopId, input), 201);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function privateJson(data: unknown, status = 200) {
  const response = NextResponse.json({data}, {status});
  response.headers.set('cache-control', 'private, no-store');
  return response;
}
