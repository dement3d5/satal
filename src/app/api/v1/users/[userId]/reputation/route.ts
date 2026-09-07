import {NextResponse} from 'next/server';

import {publicReputationQuerySchema} from '@/modules/reputation/contracts';
import {getPublicReputation} from '@/modules/reputation/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {parseQuery} from '@/server/http/query';
import {requestIdFrom} from '@/server/http/request-context';

type Context = {params: Promise<{userId: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const userId = parseUuid((await context.params).userId, 'userId');
    const query = parseQuery(request, publicReputationQuerySchema);
    const response = NextResponse.json({
      data: await getPublicReputation(getDatabase(), userId, query)
    });
    response.headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
