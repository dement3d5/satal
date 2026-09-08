import {NextResponse} from 'next/server';

import {createReviewReportSchema} from '@/modules/moderation/review-report-contracts';
import {createReviewReport} from '@/modules/moderation/review-report-service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{reviewId: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const reviewId = parseUuid((await context.params).reviewId, 'reviewId');
    const data = await createReviewReport(
      getDatabase(),
      actorId,
      reviewId,
      await parseJson(request, createReviewReportSchema)
    );
    const response = NextResponse.json({data}, {status: data.created ? 201 : 200});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
