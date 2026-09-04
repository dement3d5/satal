import type {z} from 'zod';

import {AppError} from '@/server/errors/app-error';

export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const result = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!result.success)
    throw new AppError('BAD_REQUEST', result.error.issues[0]?.message ?? 'Invalid query', 400);
  return result.data;
}
