import {NextResponse} from 'next/server';

import {removeShopMember} from '@/modules/shops/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{shopId: string; userId: string}>};

export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    await removeShopMember(
      getDatabase(),
      actorId,
      parseUuid(params.shopId, 'shopId'),
      parseUuid(params.userId, 'userId')
    );
    return new NextResponse(null, {status: 204});
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
