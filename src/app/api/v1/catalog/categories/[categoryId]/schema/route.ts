import {NextResponse} from 'next/server';

import {getCategorySchema} from '@/modules/catalog/repository';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {errorResponse} from '@/server/errors/http';
import {parseLocale, parseUuid} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

export async function GET(request: Request, context: {params: Promise<{categoryId: string}>}) {
  const requestId = requestIdFrom(request);
  try {
    const locale = parseLocale(new URL(request.url).searchParams.get('locale'));
    const categoryId = parseUuid((await context.params).categoryId, 'categoryId');
    const schema = await getCategorySchema(getDatabase(), categoryId, locale);
    if (!schema) throw new AppError('NOT_FOUND', 'Category was not found', 404);
    const response = NextResponse.json({data: schema});
    response.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
