import {sql} from 'drizzle-orm';

import geographyJson from '../data/geography/dev.az.json' with {type: 'json'};
import {geographyDatasetSchema} from '../src/modules/geography/import-schema';
import {assertLocationPlacement} from '../src/modules/geography/domain';
import {getDatabase} from '../src/server/db/client';
import {
  attributeDefinition,
  attributeOption,
  attributeOptionTranslation,
  attributeTranslation,
  category,
  categoryAttribute,
  categoryTranslation,
  location,
  locationAlias,
  locationTranslation,
  supportedLocale
} from '../src/server/db/schema';
import {applicabilitySeed, attributeSeed, categorySeed, optionSeed} from './seed/catalog-data';

const locales = ['az', 'ru', 'en'] as const;

async function seed(): Promise<void> {
  const database = getDatabase();
  const geography = geographyDatasetSchema.parse(geographyJson);

  await database.transaction(async (transaction) => {
    await transaction
      .insert(supportedLocale)
      .values(locales.map((code) => ({code, isDefault: code === 'az'})))
      .onConflictDoUpdate({
        target: supportedLocale.code,
        set: {enabled: true, updatedAt: sql`now()`}
      });

    const importedLocations = new Map<
      string,
      {kind: (typeof geography.locations)[number]['kind']; depth: number}
    >();
    for (const item of geography.locations) {
      const parent = item.parentId ? importedLocations.get(item.parentId) : null;
      if (item.parentId && !parent)
        throw new Error(`Location parent ${item.parentId} must precede its child`);
      assertLocationPlacement({kind: item.kind, depth: item.depth, parent: parent ?? null});

      await transaction
        .insert(location)
        .values({
          id: item.id,
          parentId: item.parentId,
          slug: item.slug,
          kind: item.kind,
          depth: item.depth,
          sortOrder: item.sortOrder,
          sourceName: geography.dataset.sourceName,
          sourceId: item.sourceId,
          verifiedAt: geography.dataset.verified ? new Date() : null
        })
        .onConflictDoUpdate({
          target: location.id,
          set: {
            parentId: item.parentId,
            slug: item.slug,
            kind: item.kind,
            depth: item.depth,
            sortOrder: item.sortOrder,
            sourceName: geography.dataset.sourceName,
            sourceId: item.sourceId,
            verifiedAt: geography.dataset.verified ? new Date() : null,
            enabled: true,
            updatedAt: sql`now()`
          }
        });

      await transaction
        .insert(locationTranslation)
        .values(locales.map((locale) => ({locationId: item.id, locale, name: item.names[locale]})))
        .onConflictDoUpdate({
          target: [locationTranslation.locationId, locationTranslation.locale],
          set: {name: sql`excluded.name`, updatedAt: sql`now()`}
        });

      for (const alias of item.aliases) {
        const normalizedAlias = normalizeAlias(alias.value);
        await transaction
          .insert(locationAlias)
          .values({locationId: item.id, locale: alias.locale, alias: alias.value, normalizedAlias})
          .onConflictDoUpdate({
            target: [locationAlias.locale, locationAlias.normalizedAlias],
            set: {locationId: item.id, alias: alias.value, updatedAt: sql`now()`}
          });
      }
      importedLocations.set(item.id, {kind: item.kind, depth: item.depth});
    }

    for (const [id, parentId, slug, depth, sortOrder, names] of categorySeed) {
      await transaction
        .insert(category)
        .values({id, parentId, slug, depth, sortOrder})
        .onConflictDoUpdate({
          target: category.id,
          set: {parentId, slug, depth, sortOrder, enabled: true, updatedAt: sql`now()`}
        });
      await transaction
        .insert(categoryTranslation)
        .values([
          {categoryId: id, locale: 'az', name: names[0]},
          {categoryId: id, locale: 'ru', name: names[1]},
          {categoryId: id, locale: 'en', name: names[2]}
        ])
        .onConflictDoUpdate({
          target: [categoryTranslation.categoryId, categoryTranslation.locale],
          set: {name: sql`excluded.name`, updatedAt: sql`now()`}
        });
    }

    for (const item of attributeSeed) {
      await transaction
        .insert(attributeDefinition)
        .values({
          id: item.id,
          key: item.key,
          valueType: item.valueType,
          unit: item.unit,
          minNumeric: item.minNumeric,
          maxNumeric: item.maxNumeric,
          minLength: item.minLength,
          maxLength: item.maxLength,
          minSelections: item.minSelections,
          maxSelections: item.maxSelections
        })
        .onConflictDoUpdate({
          target: attributeDefinition.id,
          set: {
            key: item.key,
            valueType: item.valueType,
            unit: item.unit ?? null,
            minNumeric: item.minNumeric ?? null,
            maxNumeric: item.maxNumeric ?? null,
            minLength: item.minLength ?? null,
            maxLength: item.maxLength ?? null,
            minSelections: item.minSelections ?? null,
            maxSelections: item.maxSelections ?? null,
            enabled: true,
            updatedAt: sql`now()`
          }
        });
      await transaction
        .insert(attributeTranslation)
        .values([
          {attributeId: item.id, locale: 'az', label: item.labels[0]},
          {attributeId: item.id, locale: 'ru', label: item.labels[1]},
          {attributeId: item.id, locale: 'en', label: item.labels[2]}
        ])
        .onConflictDoUpdate({
          target: [attributeTranslation.attributeId, attributeTranslation.locale],
          set: {label: sql`excluded.label`, updatedAt: sql`now()`}
        });
    }

    for (const [id, attributeId, key, sortOrder, labels] of optionSeed) {
      await transaction
        .insert(attributeOption)
        .values({id, attributeId, key, sortOrder})
        .onConflictDoUpdate({
          target: attributeOption.id,
          set: {attributeId, key, sortOrder, enabled: true, updatedAt: sql`now()`}
        });
      await transaction
        .insert(attributeOptionTranslation)
        .values([
          {optionId: id, locale: 'az', label: labels[0]},
          {optionId: id, locale: 'ru', label: labels[1]},
          {optionId: id, locale: 'en', label: labels[2]}
        ])
        .onConflictDoUpdate({
          target: [attributeOptionTranslation.optionId, attributeOptionTranslation.locale],
          set: {label: sql`excluded.label`, updatedAt: sql`now()`}
        });
    }

    for (const [
      categoryId,
      attributeId,
      required,
      filterable,
      searchable,
      sortable,
      sortOrder
    ] of applicabilitySeed) {
      await transaction
        .insert(categoryAttribute)
        .values({categoryId, attributeId, required, filterable, searchable, sortable, sortOrder})
        .onConflictDoUpdate({
          target: [categoryAttribute.categoryId, categoryAttribute.attributeId],
          set: {required, filterable, searchable, sortable, sortOrder, updatedAt: sql`now()`}
        });
    }
  });
}

function normalizeAlias(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('az')
    .trim();
}

seed()
  .then(() => {
    process.stdout.write('Phase 3 reference seed completed.\n');
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`Phase 3 reference seed failed: ${String(error)}\n`);
    process.exit(1);
  });
