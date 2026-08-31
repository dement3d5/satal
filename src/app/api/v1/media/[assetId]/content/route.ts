import {NextResponse} from 'next/server';

import {MAX_IMAGE_BYTES} from '@/modules/media/domain';
import {receiveQuarantinedUpload} from '@/modules/media/media-service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

type Context = {params: Promise<{assetId: string}>};

export async function PUT(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    assertBoundedBody(request);
    const token = request.headers.get('x-satal-upload-token');
    if (!token) throw new AppError('FORBIDDEN', 'Upload authorization is required', 403);
    const assetId = parseUuid((await context.params).assetId, 'assetId');
    const bytes = new Uint8Array(await request.arrayBuffer());
    const response = NextResponse.json({
      data: await receiveQuarantinedUpload(getDatabase(), assetId, token, bytes)
    });
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function assertBoundedBody(request: Request): void {
  if (request.headers.get('content-encoding')) {
    throw new AppError('BAD_REQUEST', 'Compressed upload bodies are not supported', 415);
  }
  const contentLength = request.headers.get('content-length');
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    throw new AppError('BAD_REQUEST', 'A valid Content-Length header is required', 411);
  }
  const bytes = Number(contentLength);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_IMAGE_BYTES) {
    throw new AppError('BAD_REQUEST', 'Image must be between 1 byte and 10 MB', 413);
  }
}
