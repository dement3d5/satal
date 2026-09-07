import {NextResponse} from 'next/server';

import {blockConversationUser, unblockConversationUser} from '@/modules/chat/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{userId: string}>};

export async function PUT(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const userId = parseUuid((await context.params).userId, 'userId');
    const response = NextResponse.json({
      data: await blockConversationUser(getDatabase(), actorId, userId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const userId = parseUuid((await context.params).userId, 'userId');
    const response = NextResponse.json({
      data: await unblockConversationUser(getDatabase(), actorId, userId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
