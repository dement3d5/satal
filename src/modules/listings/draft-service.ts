import {and, eq, inArray, sql} from 'drizzle-orm';

import type {AttributeRules, AttributeValue, AttributeValueType} from '@/modules/catalog/domain';
import {validateAttributeValue} from '@/modules/catalog/domain';
import type {DatabaseClient} from '@/server/db/client';
import {
  attributeDefinition,
  attributeOption,
  category,
  categoryAttribute,
  location,
  listingDraft,
  listingDraftAttributeOptionValue,
  listingDraftAttributeValue
} from '@/server/db/schema';
import {AppError} from '@/server/errors/app-error';

import type {AutosaveDraftInput, DraftAttributeInput} from './draft-contracts';
import {
  assertCategoryChangeAllowed,
  assertDraftOwner,
  assertDraftVersion,
  planCategoryChange,
  type DraftStatus,
  type StoredDraftAttribute
} from './draft-domain';

type QueryExecutor = Pick<DatabaseClient, 'select'>;
type TransactionExecutor = QueryExecutor &
  Pick<DatabaseClient, 'delete' | 'execute' | 'insert' | 'update'>;

interface ScalarAttributeRow {
  attributeId: string;
  valueType: AttributeValueType;
  unit: string | null;
  textValue: string | null;
  integerValue: number | null;
  decimalValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  optionId: string | null;
}

export interface ListingDraftContract {
  id: string;
  categoryId: string;
  categorySchemaVersion: number;
  locationId: string | null;
  publicLocationPrecision: 'city' | 'district' | 'neighborhood';
  status: DraftStatus;
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  version: number;
  lastAutosavedAt: string;
  attributes: DraftAttributeInput[];
}

export async function createListingDraft(
  db: DatabaseClient,
  actorId: string,
  categoryId: string
): Promise<ListingDraftContract> {
  return db.transaction(async (tx) => {
    const categoryRow = await requireLeafCategory(tx, categoryId);
    const [created] = await tx
      .insert(listingDraft)
      .values({
        ownerId: actorId,
        categoryId,
        categorySchemaVersion: categoryRow.schemaVersion
      })
      .returning();
    if (!created) throw new AppError('UNEXPECTED_ERROR', 'Draft could not be created', 500);
    return toContract(created, []);
  });
}

export async function getListingDraft(
  db: DatabaseClient,
  actorId: string,
  draftId: string
): Promise<ListingDraftContract> {
  const draft = await requireDraft(db, draftId);
  assertDraftOwner(actorId, draft.ownerId);
  return toContract(draft, await loadStoredAttributes(db, draftId));
}

export async function autosaveListingDraft(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  input: AutosaveDraftInput
): Promise<ListingDraftContract> {
  return db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    assertDraftOwner(actorId, draft.ownerId);
    assertDraftVersion(input.version, draft.version);
    assertCategoryChangeAllowed(draft.status);

    if (input.locationId) {
      const [locationExists] = await tx
        .select({id: location.id})
        .from(location)
        .where(and(eq(location.id, input.locationId), eq(location.enabled, true)))
        .limit(1);
      if (!locationExists) throw new AppError('BAD_REQUEST', 'Location is not available', 400);
    }

    let attributes: DraftAttributeInput[] | undefined;
    if (input.attributes) {
      attributes = input.attributes;
      await validateAttributeSnapshot(tx, draft.categoryId, attributes);
      await replaceAttributes(tx, draftId, attributes);
    }

    const [updated] = await tx
      .update(listingDraft)
      .set({
        ...(input.title !== undefined ? {title: input.title.trim()} : {}),
        ...(input.description !== undefined ? {description: input.description.trim()} : {}),
        ...(input.priceMinor !== undefined ? {priceMinor: input.priceMinor} : {}),
        ...(input.locationId !== undefined ? {locationId: input.locationId} : {}),
        ...(input.publicLocationPrecision !== undefined
          ? {publicLocationPrecision: input.publicLocationPrecision}
          : {}),
        version: draft.version + 1,
        lastAutosavedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(listingDraft.id, draftId), eq(listingDraft.version, draft.version)))
      .returning();
    if (!updated) throw new AppError('CONFLICT', 'Draft was changed by a newer autosave', 409);

    return toContract(updated, attributes ?? (await loadStoredAttributes(tx, draftId)));
  });
}

export async function changeListingDraftCategory(
  db: DatabaseClient,
  actorId: string,
  draftId: string,
  input: {version: number; categoryId: string}
): Promise<{draft: ListingDraftContract; removedAttributeIds: string[]}> {
  return db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const draft = await requireDraft(tx, draftId);
    const nextCategory = await requireLeafCategory(tx, input.categoryId);
    const currentValues = await loadStoredAttributes(tx, draftId);
    const nextRules = await loadAttributeRules(tx, input.categoryId);
    const plan = planCategoryChange({
      actorId,
      ownerId: draft.ownerId,
      status: draft.status,
      expectedVersion: input.version,
      persistedVersion: draft.version,
      currentValues: currentValues.map(toStoredAttribute),
      nextRules
    });

    const retained = plan.retained.map(fromStoredAttribute);
    await replaceAttributes(tx, draftId, retained);
    const [updated] = await tx
      .update(listingDraft)
      .set({
        categoryId: input.categoryId,
        categorySchemaVersion: nextCategory.schemaVersion,
        status: plan.nextStatus,
        version: plan.nextVersion,
        lastAutosavedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(listingDraft.id, draftId), eq(listingDraft.version, draft.version)))
      .returning();
    if (!updated) throw new AppError('CONFLICT', 'Draft was changed by a newer autosave', 409);

    return {draft: toContract(updated, retained), removedAttributeIds: plan.removedAttributeIds};
  });
}

async function requireLeafCategory(executor: QueryExecutor, categoryId: string) {
  const [row] = await executor
    .select({id: category.id, schemaVersion: category.schemaVersion})
    .from(category)
    .where(and(eq(category.id, categoryId), eq(category.enabled, true)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Category was not found', 404);

  const [child] = await executor
    .select({id: category.id})
    .from(category)
    .where(and(eq(category.parentId, categoryId), eq(category.enabled, true)))
    .limit(1);
  if (child) throw new AppError('BAD_REQUEST', 'Listings require a leaf category', 400);
  return row;
}

async function requireDraft(executor: QueryExecutor, draftId: string) {
  const [row] = await executor
    .select()
    .from(listingDraft)
    .where(eq(listingDraft.id, draftId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Draft was not found', 404);
  return row;
}

async function lockDraft(
  executor: Pick<DatabaseClient, 'execute'>,
  draftId: string
): Promise<void> {
  await executor.execute(sql`select id from listing_draft where id = ${draftId} for update`);
}

async function loadAttributeRules(
  executor: QueryExecutor,
  categoryId: string
): Promise<Map<string, AttributeRules>> {
  const rows = await executor
    .select({
      id: attributeDefinition.id,
      valueType: attributeDefinition.valueType,
      unit: attributeDefinition.unit,
      minNumeric: attributeDefinition.minNumeric,
      maxNumeric: attributeDefinition.maxNumeric,
      minLength: attributeDefinition.minLength,
      maxLength: attributeDefinition.maxLength,
      validationPattern: attributeDefinition.validationPattern,
      minSelections: attributeDefinition.minSelections,
      maxSelections: attributeDefinition.maxSelections
    })
    .from(categoryAttribute)
    .innerJoin(attributeDefinition, eq(attributeDefinition.id, categoryAttribute.attributeId))
    .where(
      and(eq(categoryAttribute.categoryId, categoryId), eq(attributeDefinition.enabled, true))
    );

  const ids = rows.map((row) => row.id);
  const options = ids.length
    ? await executor
        .select({id: attributeOption.id, attributeId: attributeOption.attributeId})
        .from(attributeOption)
        .where(and(inArray(attributeOption.attributeId, ids), eq(attributeOption.enabled, true)))
    : [];
  const optionIds = new Map<string, Set<string>>();
  for (const option of options) {
    const values = optionIds.get(option.attributeId) ?? new Set<string>();
    values.add(option.id);
    optionIds.set(option.attributeId, values);
  }

  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        minNumeric: row.minNumeric === null ? null : Number(row.minNumeric),
        maxNumeric: row.maxNumeric === null ? null : Number(row.maxNumeric),
        ...(optionIds.has(row.id) ? {allowedOptionIds: optionIds.get(row.id)!} : {})
      }
    ])
  );
}

async function validateAttributeSnapshot(
  executor: QueryExecutor,
  categoryId: string,
  attributes: DraftAttributeInput[]
): Promise<void> {
  const rules = await loadAttributeRules(executor, categoryId);
  const ids = new Set<string>();
  for (const attribute of attributes) {
    if (ids.has(attribute.attributeId)) {
      throw new AppError('BAD_REQUEST', 'Each attribute may appear only once', 400);
    }
    ids.add(attribute.attributeId);
    const rule = rules.get(attribute.attributeId);
    if (!rule)
      throw new AppError('BAD_REQUEST', 'Attribute is not applicable to this category', 400);
    validateAttributeValue(rule, withoutAttributeId(attribute));
  }
}

async function replaceAttributes(
  executor: TransactionExecutor,
  draftId: string,
  attributes: DraftAttributeInput[]
): Promise<void> {
  await executor
    .delete(listingDraftAttributeOptionValue)
    .where(eq(listingDraftAttributeOptionValue.draftId, draftId));
  await executor
    .delete(listingDraftAttributeValue)
    .where(eq(listingDraftAttributeValue.draftId, draftId));

  const scalarValues = attributes.flatMap((attribute) => {
    if (attribute.type === 'multi_select') return [];
    return [{draftId, attributeId: attribute.attributeId, ...toScalarColumns(attribute)}];
  });
  const multiValues = attributes.flatMap((attribute) =>
    attribute.type === 'multi_select'
      ? attribute.optionIds.map((optionId) => ({
          draftId,
          attributeId: attribute.attributeId,
          optionId
        }))
      : []
  );
  if (scalarValues.length) await executor.insert(listingDraftAttributeValue).values(scalarValues);
  if (multiValues.length)
    await executor.insert(listingDraftAttributeOptionValue).values(multiValues);
}

async function loadStoredAttributes(
  executor: QueryExecutor,
  draftId: string
): Promise<DraftAttributeInput[]> {
  const scalar = await executor
    .select({
      attributeId: listingDraftAttributeValue.attributeId,
      valueType: attributeDefinition.valueType,
      unit: attributeDefinition.unit,
      textValue: listingDraftAttributeValue.textValue,
      integerValue: listingDraftAttributeValue.integerValue,
      decimalValue: listingDraftAttributeValue.decimalValue,
      booleanValue: listingDraftAttributeValue.booleanValue,
      dateValue: listingDraftAttributeValue.dateValue,
      optionId: listingDraftAttributeValue.optionId
    })
    .from(listingDraftAttributeValue)
    .innerJoin(
      attributeDefinition,
      eq(attributeDefinition.id, listingDraftAttributeValue.attributeId)
    )
    .where(eq(listingDraftAttributeValue.draftId, draftId));
  const multi = await executor
    .select({
      attributeId: listingDraftAttributeOptionValue.attributeId,
      optionId: listingDraftAttributeOptionValue.optionId
    })
    .from(listingDraftAttributeOptionValue)
    .where(eq(listingDraftAttributeOptionValue.draftId, draftId));

  const multiByAttribute = new Map<string, string[]>();
  for (const row of multi) {
    const values = multiByAttribute.get(row.attributeId) ?? [];
    values.push(row.optionId);
    multiByAttribute.set(row.attributeId, values);
  }

  return [
    ...scalar.map(fromScalarRow),
    ...[...multiByAttribute].map(([attributeId, optionIds]) => ({
      attributeId,
      type: 'multi_select' as const,
      optionIds
    }))
  ];
}

function fromScalarRow(row: ScalarAttributeRow): DraftAttributeInput {
  const base = {attributeId: row.attributeId};
  switch (row.valueType) {
    case 'text':
      return {...base, type: 'text', value: row.textValue!};
    case 'integer':
      return {...base, type: 'integer', value: row.integerValue!};
    case 'decimal':
      return {...base, type: 'decimal', value: Number(row.decimalValue)};
    case 'boolean':
      return {...base, type: 'boolean', value: row.booleanValue!};
    case 'single_select':
      return {...base, type: 'single_select', optionId: row.optionId!};
    case 'date':
      return {...base, type: 'date', value: row.dateValue!};
    case 'measurement':
      return {...base, type: 'measurement', value: Number(row.decimalValue), unit: row.unit!};
    case 'multi_select':
      throw new AppError('UNEXPECTED_ERROR', 'Multi-select value was stored as scalar', 500);
  }
}

function toScalarColumns(attribute: Exclude<DraftAttributeInput, {type: 'multi_select'}>) {
  switch (attribute.type) {
    case 'text':
      return {textValue: attribute.value};
    case 'integer':
      return {integerValue: attribute.value};
    case 'decimal':
    case 'measurement':
      return {decimalValue: String(attribute.value)};
    case 'boolean':
      return {booleanValue: attribute.value};
    case 'single_select':
      return {optionId: attribute.optionId};
    case 'date':
      return {dateValue: attribute.value};
  }
}

function withoutAttributeId(attribute: DraftAttributeInput): AttributeValue {
  const {attributeId, ...value} = attribute;
  void attributeId;
  return value;
}

function toStoredAttribute(attribute: DraftAttributeInput): StoredDraftAttribute {
  return {attributeId: attribute.attributeId, value: withoutAttributeId(attribute)};
}

function fromStoredAttribute(attribute: StoredDraftAttribute): DraftAttributeInput {
  if (attribute.value.type === 'multi_select') {
    return {
      attributeId: attribute.attributeId,
      type: 'multi_select',
      optionIds: [...attribute.value.optionIds]
    };
  }
  return {attributeId: attribute.attributeId, ...attribute.value};
}

function toContract(
  draft: typeof listingDraft.$inferSelect,
  attributes: DraftAttributeInput[]
): ListingDraftContract {
  return {
    id: draft.id,
    categoryId: draft.categoryId,
    categorySchemaVersion: draft.categorySchemaVersion,
    locationId: draft.locationId,
    publicLocationPrecision: draft.publicLocationPrecision,
    status: draft.status,
    title: draft.title,
    description: draft.description,
    priceMinor: draft.priceMinor,
    currency: draft.currency,
    version: draft.version,
    lastAutosavedAt: draft.lastAutosavedAt.toISOString(),
    attributes
  };
}
