import {NextResponse} from 'next/server';

import {logger} from '../logging/logger';
import {AppError} from './app-error';

export function errorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof AppError) {
    logger.warn({code: error.code, requestId}, error.message);
    return NextResponse.json(
      {error: {code: error.code, message: error.message, requestId}},
      {status: error.status}
    );
  }

  logger.error({error, requestId}, 'Unhandled request error');
  return NextResponse.json(
    {error: {code: 'UNEXPECTED_ERROR', message: 'Unexpected server error', requestId}},
    {status: 500}
  );
}
