import {and, asc, eq, inArray} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOption,
  attributeOptionTranslation,
  attributeTranslation,
  category,
  categoryAttribute,
  categoryTranslation
} from '@/server/db/schema';

import type {
  CategoryAttributeContract,
  CategoryNodeContract,
  CategorySchemaContract,
  ContractLocale
} from './contracts';

export async function listCategoryTree(
  db: DatabaseClient,
  locale: ContractLocale
): Promise<CategoryNodeContract[]> {
  const rows = await db
    .select({
      id: category.id,
      parentId: category.parentId,
      slug: category.slug,
      depth: category.depth,
      schemaVersion: category.schemaVersion,
      name: categoryTranslation.name
    })
    .from(category)
    .innerJoin(
      categoryTranslation,
      and(eq(categoryTranslation.categoryId, category.id), eq(categoryTranslation.locale, locale))
    )
    .where(eq(category.enabled, true))
    .orderBy(asc(category.depth), asc(category.sortOrder), asc(categoryTranslation.name));

  const nodes = new Map<string, CategoryNodeContract>();
  for (const row of rows) {
    nodes.set(row.id, {...row, children: []});
  }

  const roots: CategoryNodeContract[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parentId) nodes.get(row.parentId)?.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function getCategorySchema(
  db: DatabaseClient,
  categoryId: string,
  locale: ContractLocale
): Promise<CategorySchemaContract | null> {
  const [categoryRow] = await db
    .select({
      id: category.id,
      slug: category.slug,
      name: categoryTranslation.name,
      schemaVersion: category.schemaVersion
    })
    .from(category)
    .innerJoin(
      categoryTranslation,
      and(eq(categoryTranslation.categoryId, category.id), eq(categoryTranslation.locale, locale))
    )
    .where(and(eq(category.id, categoryId), eq(category.enabled, true)))
    .limit(1);

  if (!categoryRow) return null;

  const attributeRows = await db
    .select({
      id: attributeDefinition.id,
      key: attributeDefinition.key,
      label: attributeTranslation.label,
      helpText: attributeTranslation.helpText,
      valueType: attributeDefinition.valueType,
      unit: attributeDefinition.unit,
      minNumeric: attributeDefinition.minNumeric,
      maxNumeric: attributeDefinition.maxNumeric,
      minLength: attributeDefinition.minLength,
      maxLength: attributeDefinition.maxLength,
      pattern: attributeDefinition.validationPattern,
      minSelections: attributeDefinition.minSelections,
      maxSelections: attributeDefinition.maxSelections,
      required: categoryAttribute.required,
      filterable: categoryAttribute.filterable,
      searchable: categoryAttribute.searchable,
      sortable: categoryAttribute.sortable,
      order: categoryAttribute.sortOrder
    })
    .from(categoryAttribute)
    .innerJoin(attributeDefinition, eq(attributeDefinition.id, categoryAttribute.attributeId))
    .innerJoin(
      attributeTranslation,
      and(
        eq(attributeTranslation.attributeId, attributeDefinition.id),
        eq(attributeTranslation.locale, locale)
      )
    )
    .where(and(eq(categoryAttribute.categoryId, categoryId), eq(attributeDefinition.enabled, true)))
    .orderBy(asc(categoryAttribute.sortOrder));

  const attributeIds = attributeRows.map((row) => row.id);
  const optionRows = attributeIds.length
    ? await db
        .select({
          id: attributeOption.id,
          attributeId: attributeOption.attributeId,
          key: attributeOption.key,
          label: attributeOptionTranslation.label
        })
        .from(attributeOption)
        .innerJoin(
          attributeOptionTranslation,
          and(
            eq(attributeOptionTranslation.optionId, attributeOption.id),
            eq(attributeOptionTranslation.locale, locale)
          )
        )
        .where(
          and(inArray(attributeOption.attributeId, attributeIds), eq(attributeOption.enabled, true))
        )
        .orderBy(asc(attributeOption.sortOrder))
    : [];

  const optionsByAttribute = new Map<string, CategoryAttributeContract['options']>();
  for (const option of optionRows) {
    const values = optionsByAttribute.get(option.attributeId) ?? [];
    values.push({id: option.id, key: option.key, label: option.label});
    optionsByAttribute.set(option.attributeId, values);
  }

  return {
    category: categoryRow,
    attributes: attributeRows.map((row) => {
      const {
        minNumeric,
        maxNumeric,
        minLength,
        maxLength,
        pattern,
        minSelections,
        maxSelections,
        ...attribute
      } = row;
      return {
        ...attribute,
        constraints: {
          minNumeric: minNumeric === null ? null : Number(minNumeric),
          maxNumeric: maxNumeric === null ? null : Number(maxNumeric),
          minLength,
          maxLength,
          pattern,
          minSelections,
          maxSelections
        },
        options: optionsByAttribute.get(row.id) ?? []
      };
    })
  };
}
