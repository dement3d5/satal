import {and, eq, inArray} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {attributeDefinition, attributeOption, categoryAttribute} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {DynamicSearchFilter} from './contracts';

export async function validateDynamicFilters(
  db: DatabaseClient,
  categoryId: string | undefined,
  filters: DynamicSearchFilter[]
): Promise<void> {
  if (!filters.length) return;
  if (!categoryId) {
    throw new AppError('BAD_REQUEST', 'A category is required for attribute filters', 400);
  }
  const attributeIds = filters.map((filter) => filter.attributeId);
  const rows = await db
    .select({
      id: attributeDefinition.id,
      valueType: attributeDefinition.valueType
    })
    .from(categoryAttribute)
    .innerJoin(attributeDefinition, eq(attributeDefinition.id, categoryAttribute.attributeId))
    .where(
      and(
        eq(categoryAttribute.categoryId, categoryId),
        eq(categoryAttribute.filterable, true),
        eq(attributeDefinition.enabled, true),
        inArray(attributeDefinition.id, attributeIds)
      )
    );
  const rules = new Map(rows.map((row) => [row.id, row.valueType]));
  const requestedOptionIds = filters.flatMap((filter) =>
    filter.type === 'options' ? filter.optionIds : []
  );
  const options = requestedOptionIds.length
    ? await db
        .select({id: attributeOption.id, attributeId: attributeOption.attributeId})
        .from(attributeOption)
        .where(
          and(inArray(attributeOption.id, requestedOptionIds), eq(attributeOption.enabled, true))
        )
    : [];
  const optionOwners = new Map(options.map((option) => [option.id, option.attributeId]));

  for (const filter of filters) {
    const valueType = rules.get(filter.attributeId);
    if (!valueType) throw new AppError('BAD_REQUEST', 'Attribute is not filterable here', 400);
    if (filter.type === 'options') {
      if (valueType !== 'single_select' && valueType !== 'multi_select') {
        throw new AppError('BAD_REQUEST', 'Options do not match the attribute type', 400);
      }
      if (filter.optionIds.some((optionId) => optionOwners.get(optionId) !== filter.attributeId)) {
        throw new AppError('BAD_REQUEST', 'Attribute option is not applicable', 400);
      }
    } else if (filter.type === 'numeric') {
      if (!['integer', 'decimal', 'measurement'].includes(valueType)) {
        throw new AppError('BAD_REQUEST', 'Numeric bounds do not match the attribute type', 400);
      }
      if (filter.min !== undefined && filter.max !== undefined && filter.min > filter.max) {
        throw new AppError('BAD_REQUEST', 'Minimum attribute value cannot exceed maximum', 400);
      }
    } else if (valueType !== 'boolean') {
      throw new AppError('BAD_REQUEST', 'Boolean filter does not match the attribute type', 400);
    }
  }
}
