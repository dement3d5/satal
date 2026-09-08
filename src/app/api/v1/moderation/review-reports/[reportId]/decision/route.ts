import {NextResponse} from 'next/server';

import {reviewReportDecisionSchema} from '@/modules/moderation/review-report-contracts';
import {decideReviewReport} from '@/modules/moderation/review-report-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{reportId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const reportId = parseUuid((await context.params).reportId, 'reportId');
    const input = await parseJson(request, reviewReportDecisionSchema);
    const response = NextResponse.json({
      data: await decideReviewReport(getDatabase(), actorId, reportId, input)
    });
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
