import {randomUUID} from 'node:crypto';

import {AppError} from '@/server/errors/app-error';

import {auth} from '@/modules/identity/auth';

export function requestIdFrom(request: Request): string {
  return request.headers.get('x-request-id')?.slice(0, 120) || randomUUID();
}

export async function requireActorId(headers: Headers): Promise<string> {
  const session = await auth.api.getSession({headers});
  if (!session) {
    throw new AppError('UNAUTHORIZED', 'Authentication is required', 401);
  }
  return session.user.id;
}
