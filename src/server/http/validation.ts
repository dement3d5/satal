import {z} from 'zod';

import {AppError} from '@/server/errors/app-error';

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON', 400);
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('BAD_REQUEST', result.error.issues[0]?.message ?? 'Invalid request', 400);
  }
  return result.data;
}
