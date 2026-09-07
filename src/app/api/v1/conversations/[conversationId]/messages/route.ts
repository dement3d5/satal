import {NextResponse} from 'next/server';

import {messageListQuerySchema, sendMessageSchema} from '@/modules/chat/contracts';
import {listConversationMessages, sendConversationMessage} from '@/modules/chat/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {parseQuery} from '@/server/http/query';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{conversationId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const conversationId = parseUuid((await context.params).conversationId, 'conversationId');
    const query = parseQuery(request, messageListQuerySchema);
    const response = NextResponse.json({
      data: await listConversationMessages(getDatabase(), actorId, conversationId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const conversationId = parseUuid((await context.params).conversationId, 'conversationId');
    const input = await parseJson(request, sendMessageSchema);
    const data = await sendConversationMessage(getDatabase(), actorId, conversationId, input);
    const response = NextResponse.json({data}, {status: data.created ? 201 : 200});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
