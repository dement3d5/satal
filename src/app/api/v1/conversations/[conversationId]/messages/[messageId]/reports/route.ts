import {NextResponse} from 'next/server';

import {createMessageReportSchema} from '@/modules/moderation/message-report-contracts';
import {
  createMessageReport,
  getOwnMessageReport
} from '@/modules/moderation/message-report-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{conversationId: string; messageId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    const conversationId = parseUuid(params.conversationId, 'conversationId');
    const messageId = parseUuid(params.messageId, 'messageId');
    const response = NextResponse.json({
      data: await getOwnMessageReport(getDatabase(), actorId, conversationId, messageId)
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
    const params = await context.params;
    const conversationId = parseUuid(params.conversationId, 'conversationId');
    const messageId = parseUuid(params.messageId, 'messageId');
    const input = await parseJson(request, createMessageReportSchema);
    const data = await createMessageReport(
      getDatabase(),
      actorId,
      conversationId,
      messageId,
      input
    );
    const response = NextResponse.json({data}, {status: data.created ? 201 : 200});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
