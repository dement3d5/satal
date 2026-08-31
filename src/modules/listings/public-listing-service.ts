import {and, desc, eq, inArray, lt, or} from 'drizzle-orm';

import type {AppLocale} from '@/i18n/routing';
import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOptionTranslation,
  attributeTranslation,
  categoryTranslation,
  listing,
  listingAttributeOptionValue,
  listingAttributeValue,
  listingMedia,
  locationTranslation,
  mediaAsset,
  mediaVariant,
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
}

export interface PublicListingAttribute {
  attributeId: string;
  label: string;
  value: string | number | boolean | string[];
  unit: string | null;
}

export interface PublicListingDetail extends PublicListingCard {
  description: string;
  sellerName: string;
  attributes: PublicListingAttribute[];
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
        query.categoryId ? eq(listing.categoryId, query.categoryId) : undefined,
        query.locationId ? eq(listing.locationId, query.locationId) : undefined,
        cursorCondition
      )
    )
    .orderBy(desc(listing.publishedAt), desc(listing.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const covers = await loadCoverUrls(
    db,
    page.map((row) => row.id),
    'card'
  );
  const items = page.map((row) => toCard(row, covers.get(row.id) ?? null));
  return {items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null};
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
      categoryName: categoryTranslation.name,
      locationName: locationTranslation.name,
      sellerName: user.name,
      publishedAt: listing.publishedAt
    })
    .from(listing)
    .innerJoin(user, eq(user.id, listing.sellerId))
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

  const [scalarRows, multiRows, covers] = await Promise.all([
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
    loadCoverUrls(db, [listingId], 'detail')
  ]);

  const multi = new Map<string, {label: string; values: string[]}>();
  for (const item of multiRows) {
    const current = multi.get(item.attributeId) ?? {label: item.label, values: []};
    current.values.push(item.optionLabel);
    multi.set(item.attributeId, current);
  }

  return {
    ...toCard(row, covers.get(listingId) ?? null),
    description: row.description,
    sellerName: row.sellerName,
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
  mediaUrl: string | null
): PublicListingCard {
  if (!row.publishedAt) throw new AppError('UNEXPECTED_ERROR', 'Active listing has no date', 500);
  return {...row, mediaUrl, publishedAt: row.publishedAt.toISOString()};
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
