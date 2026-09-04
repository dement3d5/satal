import {and, count, desc, eq} from 'drizzle-orm';

import type {AppLocale} from '@/i18n/routing';
import {getPublicListingCardsByIds} from '@/modules/listings/public-listing-service';
import {parseSearchParams, type SearchQuery} from '@/modules/search/contracts';
import type {DatabaseClient} from '@/server/db/client';
import {
  category,
  favoriteListing,
  listing,
  location,
  savedSearch,
  type SavedSearchFilterSnapshot
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

const SAVED_SEARCH_LIMIT = 50;

export async function addFavorite(db: DatabaseClient, actorId: string, listingId: string) {
  const [publicListing] = await db
    .select({id: listing.id})
    .from(listing)
    .where(and(eq(listing.id, listingId), eq(listing.status, 'active')))
    .limit(1);
  if (!publicListing) throw new AppError('NOT_FOUND', 'Listing was not found', 404);

  await db
    .insert(favoriteListing)
    .values({userId: actorId, listingId})
    .onConflictDoNothing();
  return {listingId, favorite: true};
}

export async function removeFavorite(db: DatabaseClient, actorId: string, listingId: string) {
  await db
    .delete(favoriteListing)
    .where(and(eq(favoriteListing.userId, actorId), eq(favoriteListing.listingId, listingId)));
  return {listingId, favorite: false};
}

export async function getFavoriteStatus(db: DatabaseClient, actorId: string, listingId: string) {
  const [row] = await db
    .select({listingId: favoriteListing.listingId})
    .from(favoriteListing)
    .where(and(eq(favoriteListing.userId, actorId), eq(favoriteListing.listingId, listingId)))
    .limit(1);
  return {listingId, favorite: Boolean(row)};
}

export async function listFavorites(db: DatabaseClient, actorId: string, locale: AppLocale) {
  const rows = await db
    .select({listingId: favoriteListing.listingId})
    .from(favoriteListing)
    .where(eq(favoriteListing.userId, actorId))
    .orderBy(desc(favoriteListing.createdAt));
  return getPublicListingCardsByIds(
    db,
    locale,
    rows.map((row) => row.listingId)
  );
}

export async function createSavedSearch(
  db: DatabaseClient,
  actorId: string,
  input: {name: string; locale: AppLocale; query: string}
) {
  const query = parseSearchParams(new URLSearchParams(input.query));
  await validateSearchReferences(db, query);
  const [total] = await db
    .select({value: count()})
    .from(savedSearch)
    .where(eq(savedSearch.ownerId, actorId));
  if ((total?.value ?? 0) >= SAVED_SEARCH_LIMIT)
    throw new AppError('CONFLICT', 'Saved search limit reached', 409);

  try {
    const [row] = await db
      .insert(savedSearch)
      .values({
        ownerId: actorId,
        name: input.name,
        locale: input.locale,
        queryText: query.q,
        categoryId: query.categoryId,
        locationId: query.locationId,
        priceMinMinor: query.priceMinMinor,
        priceMaxMinor: query.priceMaxMinor,
        sort: query.sort,
        filters: query.filters
      })
      .returning();
    if (!row) throw new AppError('UNEXPECTED_ERROR', 'Saved search was not created', 500);
    return toSavedSearch(row);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppError('CONFLICT', 'A saved search with this name already exists', 409);
    throw error;
  }
}

export async function listSavedSearches(db: DatabaseClient, actorId: string, locale?: AppLocale) {
  const rows = await db
    .select()
    .from(savedSearch)
    .where(
      and(eq(savedSearch.ownerId, actorId), locale ? eq(savedSearch.locale, locale) : undefined)
    )
    .orderBy(desc(savedSearch.updatedAt));
  return rows.map(toSavedSearch);
}

export async function renameSavedSearch(
  db: DatabaseClient,
  actorId: string,
  savedSearchId: string,
  name: string
) {
  try {
    const [row] = await db
      .update(savedSearch)
      .set({name, updatedAt: new Date()})
      .where(and(eq(savedSearch.id, savedSearchId), eq(savedSearch.ownerId, actorId)))
      .returning();
    if (!row) throw new AppError('NOT_FOUND', 'Saved search was not found', 404);
    return toSavedSearch(row);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AppError('CONFLICT', 'A saved search with this name already exists', 409);
    throw error;
  }
}

export async function deleteSavedSearch(
  db: DatabaseClient,
  actorId: string,
  savedSearchId: string
) {
  const [row] = await db
    .delete(savedSearch)
    .where(and(eq(savedSearch.id, savedSearchId), eq(savedSearch.ownerId, actorId)))
    .returning({id: savedSearch.id});
  if (!row) throw new AppError('NOT_FOUND', 'Saved search was not found', 404);
  return {id: row.id, deleted: true};
}

async function validateSearchReferences(db: DatabaseClient, query: SearchQuery) {
  if (query.categoryId) {
    const [row] = await db
      .select({id: category.id})
      .from(category)
      .where(and(eq(category.id, query.categoryId), eq(category.enabled, true)))
      .limit(1);
    if (!row) throw new AppError('BAD_REQUEST', 'Category is unavailable', 400);
  }
  if (query.locationId) {
    const [row] = await db
      .select({id: location.id})
      .from(location)
      .where(and(eq(location.id, query.locationId), eq(location.enabled, true)))
      .limit(1);
    if (!row) throw new AppError('BAD_REQUEST', 'Location is unavailable', 400);
  }
}

function toSavedSearch(row: typeof savedSearch.$inferSelect) {
  const query: SearchQuery = {
    q: row.queryText,
    ...(row.categoryId ? {categoryId: row.categoryId} : {}),
    ...(row.locationId ? {locationId: row.locationId} : {}),
    ...(row.priceMinMinor !== null ? {priceMinMinor: row.priceMinMinor} : {}),
    ...(row.priceMaxMinor !== null ? {priceMaxMinor: row.priceMaxMinor} : {}),
    sort: row.sort as SearchQuery['sort'],
    page: 1,
    limit: 24,
    filters: row.filters as SavedSearchFilterSnapshot[]
  };
  return {
    id: row.id,
    name: row.name,
    locale: row.locale as AppLocale,
    href: `/${row.locale}/search?${serializeSearchQuery(query)}`,
    query,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeSearchQuery(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.locationId) params.set('locationId', query.locationId);
  if (query.priceMinMinor !== undefined) params.set('priceMin', String(query.priceMinMinor / 100));
  if (query.priceMaxMinor !== undefined) params.set('priceMax', String(query.priceMaxMinor / 100));
  if (query.sort !== 'newest') params.set('sort', query.sort);
  for (const filter of query.filters) {
    if (filter.type === 'options')
      for (const optionId of filter.optionIds) params.append(`f.${filter.attributeId}`, optionId);
    if (filter.type === 'numeric') {
      if (filter.min !== undefined) params.set(`n.${filter.attributeId}.min`, String(filter.min));
      if (filter.max !== undefined) params.set(`n.${filter.attributeId}.max`, String(filter.max));
    }
    if (filter.type === 'boolean') params.set(`b.${filter.attributeId}`, String(filter.value));
  }
  return params;
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as {cause?: {code?: string}; code?: string};
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}
