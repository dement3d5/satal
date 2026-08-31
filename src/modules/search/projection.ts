import {and, asc, eq, inArray, sql} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOptionTranslation,
  category,
  categoryAttribute,
  categoryTranslation,
  listing,
  listingAttributeOptionValue,
  listingAttributeValue,
  location,
  locationTranslation
} from '@/server/db/schema';

import type {SearchDocument} from './gateway';

export async function buildSearchDocument(
  db: DatabaseClient,
  listingId: string
): Promise<SearchDocument | null> {
  const [row] = await db
    .select()
    .from(listing)
    .where(and(eq(listing.id, listingId), eq(listing.status, 'active')))
    .limit(1);
  if (!row?.publishedAt) return null;

  const [categoryNames, locationNames, scalar, multi, categoryAncestors, locationAncestors] =
    await Promise.all([
      db
        .select({locale: categoryTranslation.locale, value: categoryTranslation.name})
        .from(categoryTranslation)
        .where(eq(categoryTranslation.categoryId, row.categoryId)),
      db
        .select({locale: locationTranslation.locale, value: locationTranslation.name})
        .from(locationTranslation)
        .where(eq(locationTranslation.locationId, row.locationId)),
      db
        .select({
          attributeId: listingAttributeValue.attributeId,
          valueType: attributeDefinition.valueType,
          filterable: categoryAttribute.filterable,
          searchable: categoryAttribute.searchable,
          textValue: listingAttributeValue.textValue,
          integerValue: listingAttributeValue.integerValue,
          decimalValue: listingAttributeValue.decimalValue,
          booleanValue: listingAttributeValue.booleanValue,
          optionId: listingAttributeValue.optionId
        })
        .from(listingAttributeValue)
        .innerJoin(
          attributeDefinition,
          eq(attributeDefinition.id, listingAttributeValue.attributeId)
        )
        .innerJoin(
          categoryAttribute,
          and(
            eq(categoryAttribute.categoryId, row.categoryId),
            eq(categoryAttribute.attributeId, listingAttributeValue.attributeId)
          )
        )
        .where(eq(listingAttributeValue.listingId, listingId)),
      db
        .select({
          attributeId: listingAttributeOptionValue.attributeId,
          optionId: listingAttributeOptionValue.optionId,
          filterable: categoryAttribute.filterable,
          searchable: categoryAttribute.searchable
        })
        .from(listingAttributeOptionValue)
        .innerJoin(
          categoryAttribute,
          and(
            eq(categoryAttribute.categoryId, row.categoryId),
            eq(categoryAttribute.attributeId, listingAttributeOptionValue.attributeId)
          )
        )
        .where(eq(listingAttributeOptionValue.listingId, listingId)),
      loadAncestors(db, 'category', row.categoryId),
      loadAncestors(db, 'location', row.locationId)
    ]);

  const optionIds = [
    ...new Set([
      ...scalar.flatMap((item) => item.optionId ?? []),
      ...multi.map((item) => item.optionId)
    ])
  ];
  const optionLabels = optionIds.length
    ? await db
        .select({
          optionId: attributeOptionTranslation.optionId,
          locale: attributeOptionTranslation.locale,
          value: attributeOptionTranslation.label
        })
        .from(attributeOptionTranslation)
        .where(inArray(attributeOptionTranslation.optionId, optionIds))
    : [];
  const labels = new Map<string, string[]>();
  for (const item of optionLabels) {
    const key = `${item.optionId}:${item.locale}`;
    labels.set(key, [...(labels.get(key) ?? []), item.value]);
  }

  const searchText = {
    az: [row.title, row.description],
    ru: [row.title, row.description],
    en: [row.title, row.description]
  };
  for (const item of [...categoryNames, ...locationNames]) {
    if (item.locale === 'az' || item.locale === 'ru' || item.locale === 'en') {
      searchText[item.locale].push(item.value);
    }
  }
  const facetTokens: string[] = [];
  const numericFacets: Record<string, number> = {};
  for (const item of scalar) {
    if (item.searchable && item.textValue)
      Object.values(searchText).forEach((values) => values.push(item.textValue!));
    if (item.optionId) {
      if (item.filterable) facetTokens.push(facetToken(item.attributeId, item.optionId));
      if (item.searchable) addOptionLabels(searchText, labels, item.optionId);
    }
    if (item.filterable && item.booleanValue !== null) {
      facetTokens.push(facetToken(item.attributeId, String(item.booleanValue)));
    }
    const numeric =
      item.decimalValue ?? (item.integerValue === null ? null : String(item.integerValue));
    if (item.filterable && numeric !== null)
      numericFacets[numericFacetKey(item.attributeId)] = Number(numeric);
  }
  for (const item of multi) {
    if (item.filterable) facetTokens.push(facetToken(item.attributeId, item.optionId));
    if (item.searchable) addOptionLabels(searchText, labels, item.optionId);
  }

  return {
    id: row.id,
    version: row.version,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    categoryAncestors,
    locationId: row.locationId,
    locationAncestors,
    priceMinor: row.priceMinor,
    publishedAt: row.publishedAt.getTime(),
    searchTextAz: searchText.az.join(' '),
    searchTextRu: searchText.ru.join(' '),
    searchTextEn: searchText.en.join(' '),
    facetTokens,
    numericFacets
  };
}

export async function* streamActiveSearchDocuments(
  db: DatabaseClient,
  batchSize = 100
): AsyncGenerator<SearchDocument> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await db
      .select({id: listing.id})
      .from(listing)
      .where(and(eq(listing.status, 'active'), cursor ? sqlIdAfter(cursor) : undefined))
      .orderBy(asc(listing.id))
      .limit(batchSize);
    if (!rows.length) return;
    for (const row of rows) {
      const document = await buildSearchDocument(db, row.id);
      if (document) yield document;
    }
    cursor = rows.at(-1)!.id;
  }
}

async function loadAncestors(
  db: DatabaseClient,
  table: 'category' | 'location',
  id: string
): Promise<string[]> {
  const rows =
    table === 'category'
      ? await db
          .select({id: category.id, parentId: category.parentId})
          .from(category)
          .where(eq(category.enabled, true))
      : await db
          .select({id: location.id, parentId: location.parentId})
          .from(location)
          .where(eq(location.enabled, true));
  const parents = new Map(rows.map((row) => [row.id, row.parentId]));
  const result: string[] = [];
  let current: string | null | undefined = id;
  while (current) {
    result.push(current);
    current = parents.get(current);
  }
  return result;
}

function addOptionLabels(
  searchText: Record<'az' | 'ru' | 'en', string[]>,
  labels: Map<string, string[]>,
  optionId: string
): void {
  for (const locale of ['az', 'ru', 'en'] as const) {
    searchText[locale].push(...(labels.get(`${optionId}:${locale}`) ?? []));
  }
}

export function facetToken(attributeId: string, value: string): string {
  return `${attributeId.replaceAll('-', '')}_${value.replaceAll('-', '')}`;
}

export function numericFacetKey(attributeId: string): string {
  return `a_${attributeId.replaceAll('-', '')}`;
}

function sqlIdAfter(cursor: string) {
  return sql`${listing.id} > ${cursor}`;
}
