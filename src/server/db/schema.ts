import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import type {AnyPgColumn} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';

const timestamps = {
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull()
};

export const user = pgTable(
  'user',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', {length: 120}).notNull(),
    email: varchar('email', {length: 320}).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    phoneNumber: varchar('phone_number', {length: 32}),
    phoneNumberVerified: boolean('phone_number_verified').default(false).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('user_email_unique').on(table.email),
    uniqueIndex('user_phone_unique').on(table.phoneNumber)
  ]
);

export const session = pgTable(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    ipAddress: varchar('ip_address', {length: 64}),
    userAgent: text('user_agent'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_user_idx').on(table.userId)
  ]
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {withTimezone: true}),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {withTimezone: true}),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('account_issuer_account_unique').on(table.issuer, table.accountId),
    index('account_user_idx').on(table.userId)
  ]
);

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    ...timestamps
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const supportedLocale = pgTable('supported_locale', {
  code: varchar('code', {length: 8}).primaryKey(),
  isDefault: boolean('is_default').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  ...timestamps
});

export const authSchema = {user, session, account, verification};

export const locationKind = pgEnum('location_kind', [
  'country',
  'economic_region',
  'city',
  'district',
  'settlement',
  'neighborhood',
  'metro',
  'street'
]);

export const location = pgTable(
  'location',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => location.id, {
      onDelete: 'restrict'
    }),
    slug: varchar('slug', {length: 160}).notNull(),
    kind: locationKind('kind').notNull(),
    depth: smallint('depth').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    sourceName: varchar('source_name', {length: 120}).notNull(),
    sourceId: varchar('source_id', {length: 160}),
    verifiedAt: timestamp('verified_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('location_slug_unique').on(table.slug),
    uniqueIndex('location_source_identity_unique').on(table.sourceName, table.sourceId),
    index('location_parent_kind_order_idx').on(table.parentId, table.kind, table.sortOrder),
    check('location_depth_range', sql`${table.depth} between 0 and 7`),
    check(
      'location_root_parent_consistency',
      sql`(${table.depth} = 0 and ${table.parentId} is null) or (${table.depth} > 0 and ${table.parentId} is not null)`
    )
  ]
);

export const locationTranslation = pgTable(
  'location_translation',
  {
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id, {onDelete: 'cascade'}),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    name: varchar('name', {length: 200}).notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.locationId, table.locale]}),
    index('location_translation_locale_name_idx').on(table.locale, table.name)
  ]
);

export const locationAlias = pgTable(
  'location_alias',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id, {onDelete: 'cascade'}),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    alias: varchar('alias', {length: 200}).notNull(),
    normalizedAlias: varchar('normalized_alias', {length: 200}).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('location_alias_locale_normalized_unique').on(table.locale, table.normalizedAlias),
    index('location_alias_location_idx').on(table.locationId)
  ]
);

export const category = pgTable(
  'category',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => category.id, {
      onDelete: 'restrict'
    }),
    slug: varchar('slug', {length: 120}).notNull(),
    depth: smallint('depth').notNull(),
    schemaVersion: integer('schema_version').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('category_slug_unique').on(table.slug),
    index('category_parent_order_idx').on(table.parentId, table.sortOrder),
    check('category_depth_range', sql`${table.depth} between 0 and 2`),
    check(
      'category_root_parent_consistency',
      sql`(${table.depth} = 0 and ${table.parentId} is null) or (${table.depth} > 0 and ${table.parentId} is not null)`
    ),
    check('category_schema_version_positive', sql`${table.schemaVersion} > 0`)
  ]
);

export const categoryTranslation = pgTable(
  'category_translation',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, {onDelete: 'cascade'}),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    name: varchar('name', {length: 160}).notNull(),
    description: text('description'),
    ...timestamps
  },
  (table) => [primaryKey({columns: [table.categoryId, table.locale]})]
);

export const attributeValueType = pgEnum('attribute_value_type', [
  'text',
  'integer',
  'decimal',
  'boolean',
  'single_select',
  'multi_select',
  'date',
  'measurement'
]);

export const attributeDefinition = pgTable(
  'attribute_definition',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', {length: 100}).notNull(),
    valueType: attributeValueType('value_type').notNull(),
    unit: varchar('unit', {length: 32}),
    decimalScale: smallint('decimal_scale'),
    minNumeric: numeric('min_numeric', {precision: 18, scale: 4}),
    maxNumeric: numeric('max_numeric', {precision: 18, scale: 4}),
    minLength: integer('min_length'),
    maxLength: integer('max_length'),
    validationPattern: text('validation_pattern'),
    minSelections: smallint('min_selections'),
    maxSelections: smallint('max_selections'),
    allowCustomValue: boolean('allow_custom_value').default(false).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('attribute_definition_key_unique').on(table.key),
    check(
      'attribute_numeric_range_valid',
      sql`${table.minNumeric} is null or ${table.maxNumeric} is null or ${table.minNumeric} <= ${table.maxNumeric}`
    ),
    check(
      'attribute_length_range_valid',
      sql`${table.minLength} is null or ${table.maxLength} is null or ${table.minLength} <= ${table.maxLength}`
    ),
    check(
      'attribute_selection_range_valid',
      sql`${table.minSelections} is null or ${table.maxSelections} is null or ${table.minSelections} <= ${table.maxSelections}`
    ),
    check(
      'measurement_requires_unit',
      sql`${table.valueType} <> 'measurement' or ${table.unit} is not null`
    )
  ]
);

export const attributeTranslation = pgTable(
  'attribute_translation',
  {
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'cascade'}),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    label: varchar('label', {length: 160}).notNull(),
    helpText: text('help_text'),
    ...timestamps
  },
  (table) => [primaryKey({columns: [table.attributeId, table.locale]})]
);

export const attributeOption = pgTable(
  'attribute_option',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'cascade'}),
    key: varchar('key', {length: 100}).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('attribute_option_attribute_key_unique').on(table.attributeId, table.key),
    unique('attribute_option_attribute_id_unique').on(table.attributeId, table.id),
    index('attribute_option_order_idx').on(table.attributeId, table.sortOrder)
  ]
);

export const attributeOptionTranslation = pgTable(
  'attribute_option_translation',
  {
    optionId: uuid('option_id')
      .notNull()
      .references(() => attributeOption.id, {onDelete: 'cascade'}),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    label: varchar('label', {length: 160}).notNull(),
    ...timestamps
  },
  (table) => [primaryKey({columns: [table.optionId, table.locale]})]
);

export const categoryAttribute = pgTable(
  'category_attribute',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, {onDelete: 'cascade'}),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'restrict'}),
    required: boolean('required').default(false).notNull(),
    filterable: boolean('filterable').default(false).notNull(),
    searchable: boolean('searchable').default(false).notNull(),
    sortable: boolean('sortable').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.categoryId, table.attributeId]}),
    index('category_attribute_render_order_idx').on(table.categoryId, table.sortOrder),
    index('category_attribute_search_projection_idx').on(
      table.attributeId,
      table.filterable,
      table.searchable,
      table.sortable
    )
  ]
);

export const listingDraftStatus = pgEnum('listing_draft_status', [
  'draft',
  'ready_for_review',
  'submitted',
  'abandoned'
]);

export const publicLocationPrecision = pgEnum('public_location_precision', [
  'city',
  'district',
  'neighborhood'
]);

export const listingDraft = pgTable(
  'listing_draft',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, {onDelete: 'restrict'}),
    categorySchemaVersion: integer('category_schema_version').notNull(),
    locationId: uuid('location_id').references(() => location.id, {onDelete: 'restrict'}),
    publicLocationPrecision: publicLocationPrecision('public_location_precision')
      .default('district')
      .notNull(),
    status: listingDraftStatus('status').default('draft').notNull(),
    title: varchar('title', {length: 180}).default('').notNull(),
    description: text('description').default('').notNull(),
    priceMinor: bigint('price_minor', {mode: 'number'}),
    currency: varchar('currency', {length: 3}).default('AZN').notNull(),
    version: integer('version').default(1).notNull(),
    lastAutosavedAt: timestamp('last_autosaved_at', {withTimezone: true}).defaultNow().notNull(),
    ...timestamps
  },
  (table) => [
    index('listing_draft_owner_status_updated_idx').on(
      table.ownerId,
      table.status,
      table.updatedAt
    ),
    index('listing_draft_category_status_idx').on(table.categoryId, table.status),
    index('listing_draft_location_idx').on(table.locationId),
    check('listing_draft_schema_version_positive', sql`${table.categorySchemaVersion} > 0`),
    check('listing_draft_version_positive', sql`${table.version} > 0`),
    check(
      'listing_draft_price_non_negative',
      sql`${table.priceMinor} is null or ${table.priceMinor} >= 0`
    )
  ]
);

export const listingDraftAttributeValue = pgTable(
  'listing_draft_attribute_value',
  {
    draftId: uuid('draft_id')
      .notNull()
      .references(() => listingDraft.id, {onDelete: 'cascade'}),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'restrict'}),
    textValue: text('text_value'),
    integerValue: bigint('integer_value', {mode: 'number'}),
    decimalValue: numeric('decimal_value', {precision: 18, scale: 4}),
    booleanValue: boolean('boolean_value'),
    dateValue: date('date_value'),
    optionId: uuid('option_id').references(() => attributeOption.id, {onDelete: 'restrict'}),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.draftId, table.attributeId]}),
    foreignKey({
      columns: [table.attributeId, table.optionId],
      foreignColumns: [attributeOption.attributeId, attributeOption.id],
      name: 'draft_scalar_option_belongs_to_attribute_fk'
    }).onDelete('restrict'),
    index('draft_attribute_projection_idx').on(table.attributeId, table.optionId),
    check(
      'draft_attribute_exactly_one_scalar_value',
      sql`num_nonnulls(${table.textValue}, ${table.integerValue}, ${table.decimalValue}, ${table.booleanValue}, ${table.dateValue}, ${table.optionId}) = 1`
    )
  ]
);

export const listingDraftAttributeOptionValue = pgTable(
  'listing_draft_attribute_option_value',
  {
    draftId: uuid('draft_id')
      .notNull()
      .references(() => listingDraft.id, {onDelete: 'cascade'}),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'restrict'}),
    optionId: uuid('option_id')
      .notNull()
      .references(() => attributeOption.id, {onDelete: 'restrict'}),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.draftId, table.attributeId, table.optionId]}),
    foreignKey({
      columns: [table.attributeId, table.optionId],
      foreignColumns: [attributeOption.attributeId, attributeOption.id],
      name: 'draft_multi_option_belongs_to_attribute_fk'
    }).onDelete('restrict'),
    index('draft_multi_option_projection_idx').on(table.attributeId, table.optionId)
  ]
);

export const listingDraftStatusHistory = pgTable(
  'listing_draft_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => listingDraft.id, {onDelete: 'cascade'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    fromStatus: listingDraftStatus('from_status').notNull(),
    toStatus: listingDraftStatus('to_status').notNull(),
    reason: varchar('reason', {length: 240}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [index('draft_status_history_draft_created_idx').on(table.draftId, table.createdAt)]
);
