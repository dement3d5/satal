import {eq} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {category} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import {assertProfessionalProfileCategory, type ProfessionalProfileType} from './domain';

type QueryExecutor = Pick<DatabaseClient, 'select'>;

export async function assertProfileTypeSupportsCategory(
  executor: QueryExecutor,
  profileType: ProfessionalProfileType,
  categoryId: string
): Promise<void> {
  let currentId: string | null = categoryId;
  let rootSlug: string | null = null;

  for (let depth = 0; currentId && depth < 4; depth += 1) {
    const [row] = await executor
      .select({parentId: category.parentId, slug: category.slug})
      .from(category)
      .where(eq(category.id, currentId))
      .limit(1);
    if (!row) throw new AppError('BAD_REQUEST', 'Listing category is not available', 400);
    rootSlug = row.slug;
    currentId = row.parentId;
  }

  if (!rootSlug || currentId) {
    throw new AppError('BAD_REQUEST', 'Listing category hierarchy is invalid', 400);
  }
  assertProfessionalProfileCategory(profileType, rootSlug);
}
