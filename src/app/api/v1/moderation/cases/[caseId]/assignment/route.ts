import {NextResponse} from 'next/server';

import {claimModerationCase, releaseModerationCase} from '@/modules/moderation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{caseId: string}>};

export async function PUT(request: Request, context: Context) {
  return changeAssignment(request, context, 'claim');
}

export async function DELETE(request: Request, context: Context) {
  return changeAssignment(request, context, 'release');
}

async function changeAssignment(request: Request, context: Context, action: 'claim' | 'release') {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const caseId = parseUuid((await context.params).caseId, 'caseId');
    const data =
      action === 'claim'
        ? await claimModerationCase(getDatabase(), actorId, caseId)
        : await releaseModerationCase(getDatabase(), actorId, caseId);
    const response = NextResponse.json({data});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
