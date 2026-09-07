import {NextResponse} from 'next/server';

import {conversationListQuerySchema, startConversationSchema} from '@/modules/chat/contracts';
import {listConversations, startConversation} from '@/modules/chat/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseQuery} from '@/server/http/query';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const query = parseQuery(request, conversationListQuerySchema);
    const response = NextResponse.json({
      data: await listConversations(getDatabase(), actorId, query)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const input = await parseJson(request, startConversationSchema);
    const data = await startConversation(getDatabase(), actorId, input);
    const response = NextResponse.json({data}, {status: data.conversationCreated ? 201 : 200});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
