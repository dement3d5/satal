import {and, asc, desc, eq, inArray, lt, ne, or, sql} from 'drizzle-orm';

import type {AppLocale} from '@/i18n/routing';
import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOptionTranslation,
  attributeTranslation,
  category,
  categoryAttribute,
  categoryTranslation,
  listing,
  listingAttributeOptionValue,
  listingAttributeValue,
  listingMedia,
  locationTranslation,
  mediaAsset,
  mediaVariant,
  location,
  shop,
  user
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {PublicListingQuery} from './publication-contracts';

export interface PublicListingCard {
  id: string;
  title: string;
  priceMinor: number | null;
  currency: string;
  categoryName: string;
  locationName: string;
  publishedAt: string;
  mediaUrl: string | null;
  facts: PublicListingFact[];
}

export interface PublicListingFact {
  attributeId: string;
  label: string;
  value: string | number | boolean;
  unit: string | null;
}

export interface HomepageListingCollection {
  key: 'apartments' | 'cars';
  categoryId: string;
  categoryName: string;
  locationId: string;
  locationName: string;
  items: PublicListingCard[];
}

export interface PublicListingAttribute {
  attributeId: string;
  label: string;
  value: string | number | boolean | string[];
  unit: string | null;
}

export interface PublicListingDetail extends PublicListingCard {
  description: string;
  categoryId: string;
  locationId: string;
  sellerId: string;
  sellerName: string;
  shopId: string | null;
  shopName: string | null;
  shopSlug: string | null;
  shopVerified: boolean;
  attributes: PublicListingAttribute[];
  mediaUrls: string[];
}

const homepageScopes = [
  {key: 'apartments', categorySlug: 'apartments-for-sale'},
  {key: 'cars', categorySlug: 'passenger-cars'}
] as const;

export async function listHomepageCollections(
  db: DatabaseClient,
  locale: AppLocale,
  limit = 8
): Promise<HomepageListingCollection[]> {
  const [categories, cities] = await Promise.all([
    db
      .select({id: category.id, slug: category.slug, name: categoryTranslation.name})
      .from(category)
      .innerJoin(
        categoryTranslation,
        and(eq(categoryTranslation.categoryId, category.id), eq(categoryTranslation.locale, locale))
      )
      .where(
        and(
          eq(category.enabled, true),
          inArray(
            category.slug,
            homepageScopes.map(({categorySlug}) => categorySlug)
          )
        )
      ),
    db
      .select({id: location.id, name: locationTranslation.name})
      .from(location)
      .innerJoin(
        locationTranslation,
        and(eq(locationTranslation.locationId, location.id), eq(locationTranslation.locale, locale))
      )
      .where(and(eq(location.enabled, true), eq(location.slug, 'baku')))
      .limit(1)
  ]);
  const city = cities[0];
  if (!city) return [];
  const categoryBySlug = new Map(categories.map((item) => [item.slug, item]));

  return Promise.all(
    homepageScopes.flatMap((scope) => {
      const selectedCategory = categoryBySlug.get(scope.categorySlug);
      if (!selectedCategory) return [];
      return [
        listPublicListings(db, locale, {
          categoryId: selectedCategory.id,
          locationId: city.id,
          limit
        }).then(({items}) => ({
          key: scope.key,
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          locationId: city.id,
          locationName: city.name,
          items
        }))
      ];
    })
  );
}

export async function listPublicListings(
  db: DatabaseClient,
  locale: AppLocale,
  query: PublicListingQuery
): Promise<{items: PublicListingCard[]; nextCursor: string | null}> {
  let cursorCondition;
  if (query.cursor) {
    const [cursor] = await db
      .select({id: listing.id, publishedAt: listing.publishedAt})
      .from(listing)
      .where(and(eq(listing.id, query.cursor), eq(listing.status, 'active')))
      .limit(1);
    if (!cursor?.publishedAt) throw new AppError('BAD_REQUEST', 'Listing cursor is invalid', 400);
    cursorCondition = or(
      lt(listing.publishedAt, cursor.publishedAt),
      and(eq(listing.publishedAt, cursor.publishedAt), lt(listing.id, cursor.id))
    );
  }

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name,
      publishedAt: listing.publishedAt
    })
    .from(listing)
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, locale)
      )
    )
    .where(
      and(
        eq(listing.status, 'active'),
        query.categoryId
          ? sql`${listing.categoryId} in (
              with recursive category_scope as (
                select id from category where id = ${query.categoryId}
                union all
                select child.id from category child
                join category_scope parent on child.parent_id = parent.id
              ) select id from category_scope
            )`
          : undefined,
        query.locationId
          ? sql`${listing.locationId} in (
              with recursive location_scope as (
                select id from location where id = ${query.locationId}
                union all
                select child.id from location child
                join location_scope parent on child.parent_id = parent.id
              ) select id from location_scope
            )`
          : undefined,
        cursorCondition
      )
    )
    .orderBy(desc(listing.publishedAt), desc(listing.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const listingIds = page.map((row) => row.id);
  const [covers, facts] = await Promise.all([
    loadCoverUrls(db, listingIds, 'card'),
    loadCardFacts(db, listingIds, locale)
  ]);
  const items = page.map((row) => toCard(row, covers.get(row.id) ?? null, facts.get(row.id) ?? []));
  return {items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null};
}

export async function getPublicListingCardsByIds(
  db: DatabaseClient,
  locale: AppLocale,
  listingIds: string[]
): Promise<PublicListingCard[]> {
  if (!listingIds.length) return [];
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name,
      publishedAt: listing.publishedAt
    })
    .from(listing)
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, locale)
      )
    )
    .where(and(eq(listing.status, 'active'), inArray(listing.id, listingIds)));
  const [covers, facts] = await Promise.all([
    loadCoverUrls(db, listingIds, 'card'),
    loadCardFacts(db, listingIds, locale)
  ]);
  const order = new Map(listingIds.map((id, position) => [id, position]));
  return rows
    .sort((left, right) => order.get(left.id)! - order.get(right.id)!)
    .map((row) => toCard(row, covers.get(row.id) ?? null, facts.get(row.id) ?? []));
}

export async function listSimilarPublicListings(
  db: DatabaseClient,
  locale: AppLocale,
  input: {listingId: string; categoryId: string; locationId: string; limit?: number}
): Promise<PublicListingCard[]> {
  const rows = await db
    .select({id: listing.id})
    .from(listing)
    .where(
      and(
        eq(listing.status, 'active'),
        eq(listing.categoryId, input.categoryId),
        eq(listing.locationId, input.locationId),
        ne(listing.id, input.listingId)
      )
    )
    .orderBy(desc(listing.publishedAt), desc(listing.id))
    .limit(input.limit ?? 4);
  return getPublicListingCardsByIds(
    db,
    locale,
    rows.map(({id}) => id)
  );
}

export async function getPublicListing(
  db: DatabaseClient,
  locale: AppLocale,
  listingId: string
): Promise<PublicListingDetail> {
  const [row] = await db
    .select({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      categoryId: listing.categoryId,
      categoryName: categoryTranslation.name,
      locationId: listing.locationId,
      locationName: locationTranslation.name,
      sellerId: user.id,
      sellerName: user.name,
      shopId: shop.id,
      shopName: shop.name,
      shopSlug: shop.slug,
      shopVerificationStatus: shop.verificationStatus,
      publishedAt: listing.publishedAt
    })
    .from(listing)
    .innerJoin(user, eq(user.id, listing.sellerId))
    .leftJoin(shop, eq(shop.id, listing.shopId))
    .innerJoin(
      categoryTranslation,
      and(
        eq(categoryTranslation.categoryId, listing.categoryId),
        eq(categoryTranslation.locale, locale)
      )
    )
    .innerJoin(
      locationTranslation,
      and(
        eq(locationTranslation.locationId, listing.locationId),
        eq(locationTranslation.locale, locale)
      )
    )
    .where(and(eq(listing.id, listingId), eq(listing.status, 'active')))
    .limit(1);
  if (!row?.publishedAt) throw new AppError('NOT_FOUND', 'Listing was not found', 404);

  const [scalarRows, multiRows, mediaUrls] = await Promise.all([
    db
      .select({
        attributeId: listingAttributeValue.attributeId,
        label: attributeTranslation.label,
        unit: attributeDefinition.unit,
        textValue: listingAttributeValue.textValue,
        integerValue: listingAttributeValue.integerValue,
        decimalValue: listingAttributeValue.decimalValue,
        booleanValue: listingAttributeValue.booleanValue,
        dateValue: listingAttributeValue.dateValue,
        optionLabel: attributeOptionTranslation.label
      })
      .from(listingAttributeValue)
      .innerJoin(attributeDefinition, eq(attributeDefinition.id, listingAttributeValue.attributeId))
      .innerJoin(
        attributeTranslation,
        and(
          eq(attributeTranslation.attributeId, listingAttributeValue.attributeId),
          eq(attributeTranslation.locale, locale)
        )
      )
      .leftJoin(
        attributeOptionTranslation,
        and(
          eq(attributeOptionTranslation.optionId, listingAttributeValue.optionId),
          eq(attributeOptionTranslation.locale, locale)
        )
      )
      .where(eq(listingAttributeValue.listingId, listingId)),
    db
      .select({
        attributeId: listingAttributeOptionValue.attributeId,
        label: attributeTranslation.label,
        optionLabel: attributeOptionTranslation.label
      })
      .from(listingAttributeOptionValue)
      .innerJoin(
        attributeTranslation,
        and(
          eq(attributeTranslation.attributeId, listingAttributeOptionValue.attributeId),
          eq(attributeTranslation.locale, locale)
        )
      )
      .innerJoin(
        attributeOptionTranslation,
        and(
          eq(attributeOptionTranslation.optionId, listingAttributeOptionValue.optionId),
          eq(attributeOptionTranslation.locale, locale)
        )
      )
      .where(eq(listingAttributeOptionValue.listingId, listingId)),
    loadListingMediaUrls(db, listingId, 'detail')
  ]);

  const multi = new Map<string, {label: string; values: string[]}>();
  for (const item of multiRows) {
    const current = multi.get(item.attributeId) ?? {label: item.label, values: []};
    current.values.push(item.optionLabel);
    multi.set(item.attributeId, current);
  }

  return {
    ...toCard(row, mediaUrls[0] ?? null, []),
    description: row.description,
    categoryId: row.categoryId,
    locationId: row.locationId,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    shopId: row.shopId,
    shopName: row.shopName,
    shopSlug: row.shopSlug,
    shopVerified: row.shopVerificationStatus === 'verified',
    mediaUrls,
    attributes: [
      ...scalarRows.map((item) => ({
        attributeId: item.attributeId,
        label: item.label,
        unit: item.unit,
        value: scalarPublicValue(item)
      })),
      ...[...multi].map(([attributeId, item]) => ({
        attributeId,
        label: item.label,
        unit: null,
        value: item.values
      }))
    ]
  };
}

async function loadCardFacts(
  db: DatabaseClient,
  listingIds: string[],
  locale: AppLocale
): Promise<Map<string, PublicListingFact[]>> {
  if (!listingIds.length) return new Map();
  const rows = await db
    .select({
      listingId: listingAttributeValue.listingId,
      attributeId: listingAttributeValue.attributeId,
      label: attributeTranslation.label,
      unit: attributeDefinition.unit,
      textValue: listingAttributeValue.textValue,
      integerValue: listingAttributeValue.integerValue,
      decimalValue: listingAttributeValue.decimalValue,
      booleanValue: listingAttributeValue.booleanValue,
      dateValue: listingAttributeValue.dateValue,
      optionLabel: attributeOptionTranslation.label,
      sortOrder: categoryAttribute.sortOrder
    })
    .from(listingAttributeValue)
    .innerJoin(listing, eq(listing.id, listingAttributeValue.listingId))
    .innerJoin(
      categoryAttribute,
      and(
        eq(categoryAttribute.categoryId, listing.categoryId),
        eq(categoryAttribute.attributeId, listingAttributeValue.attributeId)
      )
    )
    .innerJoin(attributeDefinition, eq(attributeDefinition.id, listingAttributeValue.attributeId))
    .innerJoin(
      attributeTranslation,
      and(
        eq(attributeTranslation.attributeId, listingAttributeValue.attributeId),
        eq(attributeTranslation.locale, locale)
      )
    )
    .leftJoin(
      attributeOptionTranslation,
      and(
        eq(attributeOptionTranslation.optionId, listingAttributeValue.optionId),
        eq(attributeOptionTranslation.locale, locale)
      )
    )
    .where(inArray(listingAttributeValue.listingId, listingIds))
    .orderBy(asc(categoryAttribute.sortOrder));

  const facts = new Map<string, PublicListingFact[]>();
  for (const row of rows) {
    const current = facts.get(row.listingId) ?? [];
    if (current.length >= 3) continue;
    current.push({
      attributeId: row.attributeId,
      label: row.label,
      value: scalarPublicValue(row),
      unit: row.unit
    });
    facts.set(row.listingId, current);
  }
  return facts;
}

async function loadListingMediaUrls(
  db: DatabaseClient,
  listingId: string,
  kind: 'card' | 'detail'
): Promise<string[]> {
  const rows = await db
    .select({assetId: mediaAsset.id})
    .from(listingMedia)
    .innerJoin(mediaAsset, eq(mediaAsset.id, listingMedia.mediaAssetId))
    .innerJoin(
      mediaVariant,
      and(eq(mediaVariant.mediaAssetId, mediaAsset.id), eq(mediaVariant.kind, kind))
    )
    .where(and(eq(listingMedia.listingId, listingId), eq(mediaAsset.status, 'ready')))
    .orderBy(desc(listingMedia.isCover), listingMedia.sortOrder);

  return rows.map((row) => `/api/v1/media/${row.assetId}/variants/${kind}`);
}

async function loadCoverUrls(
  db: DatabaseClient,
  listingIds: string[],
  kind: 'card' | 'detail'
): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map();
  const rows = await db
    .select({listingId: listingMedia.listingId, assetId: mediaAsset.id})
    .from(listingMedia)
    .innerJoin(mediaAsset, eq(mediaAsset.id, listingMedia.mediaAssetId))
    .innerJoin(
      mediaVariant,
      and(eq(mediaVariant.mediaAssetId, mediaAsset.id), eq(mediaVariant.kind, kind))
    )
    .where(
      and(
        inArray(listingMedia.listingId, listingIds),
        eq(listingMedia.isCover, true),
        eq(mediaAsset.status, 'ready')
      )
    );
  return new Map(
    rows.map((row) => [row.listingId, `/api/v1/media/${row.assetId}/variants/${kind}`])
  );
}

function toCard(
  row: {
    id: string;
    title: string;
    priceMinor: number | null;
    currency: string;
    categoryName: string;
    locationName: string;
    publishedAt: Date | null;
  },
  mediaUrl: string | null,
  facts: PublicListingFact[]
): PublicListingCard {
  if (!row.publishedAt) throw new AppError('UNEXPECTED_ERROR', 'Active listing has no date', 500);
  return {...row, mediaUrl, facts, publishedAt: row.publishedAt.toISOString()};
}

function scalarPublicValue(row: {
  textValue: string | null;
  integerValue: number | null;
  decimalValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  optionLabel: string | null;
}): string | number | boolean {
  if (row.textValue !== null) return row.textValue;
  if (row.integerValue !== null) return row.integerValue;
  if (row.decimalValue !== null) return Number(row.decimalValue);
  if (row.booleanValue !== null) return row.booleanValue;
  if (row.dateValue !== null) return row.dateValue;
  if (row.optionLabel !== null) return row.optionLabel;
  throw new AppError('UNEXPECTED_ERROR', 'Listing attribute has no public value', 500);
}
