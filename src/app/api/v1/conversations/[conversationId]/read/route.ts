import {NextResponse} from 'next/server';

import {markConversationRead} from '@/modules/chat/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{conversationId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const conversationId = parseUuid((await context.params).conversationId, 'conversationId');
    const response = NextResponse.json({
      data: await markConversationRead(getDatabase(), actorId, conversationId)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
