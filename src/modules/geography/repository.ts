import {and, asc, eq, isNull} from 'drizzle-orm';

import type {ContractLocale} from '@/modules/catalog/contracts';
import type {DatabaseClient} from '@/server/db/client';
import {location, locationTranslation} from '@/server/db/schema';

import type {LocationContract} from './contracts';

export async function listLocations(
  db: DatabaseClient,
  locale: ContractLocale,
  parentId: string | null
): Promise<LocationContract[]> {
  return db
    .select({
      id: location.id,
      parentId: location.parentId,
      slug: location.slug,
      name: locationTranslation.name,
      kind: location.kind,
      depth: location.depth,
      verified: location.verifiedAt
    })
    .from(location)
    .innerJoin(
      locationTranslation,
      and(eq(locationTranslation.locationId, location.id), eq(locationTranslation.locale, locale))
    )
    .where(
      and(
        eq(location.enabled, true),
        parentId === null ? isNull(location.parentId) : eq(location.parentId, parentId)
      )
    )
    .orderBy(asc(location.sortOrder), asc(locationTranslation.name))
    .then((rows) => rows.map((row) => ({...row, verified: row.verified !== null})));
}

export async function listFilterLocations(
  db: DatabaseClient,
  locale: ContractLocale
): Promise<LocationContract[]> {
  return db
    .select({
      id: location.id,
      parentId: location.parentId,
      slug: location.slug,
      name: locationTranslation.name,
      kind: location.kind,
      depth: location.depth,
      verified: location.verifiedAt
    })
    .from(location)
    .innerJoin(
      locationTranslation,
      and(eq(locationTranslation.locationId, location.id), eq(locationTranslation.locale, locale))
    )
    .where(eq(location.enabled, true))
    .orderBy(asc(location.depth), asc(location.sortOrder), asc(locationTranslation.name))
    .then((rows) => rows.map((row) => ({...row, verified: row.verified !== null})));
}
