import {and, eq, gt, isNull, or} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {user, userRole} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

export async function getOwnProfile(db: DatabaseClient, actorId: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      createdAt: user.createdAt
    })
    .from(user)
    .where(eq(user.id, actorId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Profile was not found', 404);
  const roles = await db
    .select({role: userRole.role})
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, actorId),
        or(isNull(userRole.expiresAt), gt(userRole.expiresAt, new Date()))
      )
    );
  return {
    ...row,
    staffRoles: roles.map(({role}) => role),
    createdAt: row.createdAt.toISOString()
  };
}

export async function updateOwnProfile(db: DatabaseClient, actorId: string, name: string) {
  const [row] = await db
    .update(user)
    .set({name, updatedAt: new Date()})
    .where(eq(user.id, actorId))
    .returning({id: user.id, name: user.name});
  if (!row) throw new AppError('NOT_FOUND', 'Profile was not found', 404);
  return row;
}
