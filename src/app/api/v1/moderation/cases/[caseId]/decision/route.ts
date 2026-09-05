import {NextResponse} from 'next/server';

import {moderationDecisionSchema} from '@/modules/moderation/contracts';
import {decideModerationCase} from '@/modules/moderation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{caseId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const caseId = parseUuid((await context.params).caseId, 'caseId');
    const input = await parseJson(request, moderationDecisionSchema);
    const response = NextResponse.json({
      data: await decideModerationCase(getDatabase(), actorId, caseId, input)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
