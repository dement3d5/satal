import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
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

export const staffRole = pgEnum('staff_role', ['moderator', 'admin', 'owner']);

export const userRole = pgTable(
  'user_role',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    role: staffRole('role').notNull(),
    grantedBy: uuid('granted_by').references(() => user.id, {onDelete: 'restrict'}),
    grantedAt: timestamp('granted_at', {withTimezone: true}).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true})
  },
  (table) => [
    primaryKey({columns: [table.userId, table.role]}),
    index('user_role_role_expiry_idx').on(table.role, table.expiresAt),
    check(
      'user_role_expiry_after_grant',
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.grantedAt}`
    )
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
    issuer: text('issuer'),
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
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
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

export const listingStatus = pgEnum('listing_status', [
  'pending_review',
  'active',
  'sold',
  'expired',
  'removed',
  'rejected'
]);

export const listing = pgTable(
  'listing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    sourceDraftId: uuid('source_draft_id')
      .notNull()
      .references(() => listingDraft.id, {onDelete: 'restrict'}),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, {onDelete: 'restrict'}),
    categorySchemaVersion: integer('category_schema_version').notNull(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => location.id, {onDelete: 'restrict'}),
    publicLocationPrecision: publicLocationPrecision('public_location_precision').notNull(),
    status: listingStatus('status').default('pending_review').notNull(),
    title: varchar('title', {length: 180}).notNull(),
    description: text('description').notNull(),
    priceMinor: bigint('price_minor', {mode: 'number'}),
    currency: varchar('currency', {length: 3}).default('AZN').notNull(),
    version: integer('version').default(1).notNull(),
    publishedAt: timestamp('published_at', {withTimezone: true}),
    expiresAt: timestamp('expires_at', {withTimezone: true}),
    soldAt: timestamp('sold_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('listing_source_draft_unique').on(table.sourceDraftId),
    index('listing_public_feed_idx').on(table.status, table.publishedAt, table.id),
    index('listing_category_feed_idx').on(
      table.categoryId,
      table.status,
      table.publishedAt,
      table.id
    ),
    index('listing_location_feed_idx').on(
      table.locationId,
      table.status,
      table.publishedAt,
      table.id
    ),
    index('listing_seller_status_updated_idx').on(table.sellerId, table.status, table.updatedAt),
    index('listing_public_search_idx')
      .using(
        'gin',
        sql`to_tsvector('simple', coalesce(${table.title}, '') || ' ' || coalesce(${table.description}, ''))`
      )
      .where(sql`${table.status} = 'active'`),
    check('listing_schema_version_positive', sql`${table.categorySchemaVersion} > 0`),
    check('listing_version_positive', sql`${table.version} > 0`),
    check('listing_title_not_blank', sql`length(btrim(${table.title})) >= 5`),
    check('listing_description_not_blank', sql`length(btrim(${table.description})) >= 20`),
    check(
      'listing_price_non_negative',
      sql`${table.priceMinor} is null or ${table.priceMinor} >= 0`
    ),
    check(
      'listing_active_has_published_at',
      sql`${table.status} <> 'active' or ${table.publishedAt} is not null`
    )
  ]
);

export const listingAttributeValue = pgTable(
  'listing_attribute_value',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
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
    primaryKey({columns: [table.listingId, table.attributeId]}),
    foreignKey({
      columns: [table.attributeId, table.optionId],
      foreignColumns: [attributeOption.attributeId, attributeOption.id],
      name: 'listing_scalar_option_belongs_to_attribute_fk'
    }).onDelete('restrict'),
    index('listing_attribute_projection_idx').on(
      table.attributeId,
      table.optionId,
      table.listingId
    ),
    check(
      'listing_attribute_exactly_one_scalar_value',
      sql`num_nonnulls(${table.textValue}, ${table.integerValue}, ${table.decimalValue}, ${table.booleanValue}, ${table.dateValue}, ${table.optionId}) = 1`
    )
  ]
);

export const listingAttributeOptionValue = pgTable(
  'listing_attribute_option_value',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributeDefinition.id, {onDelete: 'restrict'}),
    optionId: uuid('option_id')
      .notNull()
      .references(() => attributeOption.id, {onDelete: 'restrict'}),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.listingId, table.attributeId, table.optionId]}),
    foreignKey({
      columns: [table.attributeId, table.optionId],
      foreignColumns: [attributeOption.attributeId, attributeOption.id],
      name: 'listing_multi_option_belongs_to_attribute_fk'
    }).onDelete('restrict'),
    index('listing_multi_option_projection_idx').on(
      table.attributeId,
      table.optionId,
      table.listingId
    )
  ]
);

export const listingStatusHistory = pgTable(
  'listing_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
    actorId: uuid('actor_id').references(() => user.id, {onDelete: 'restrict'}),
    fromStatus: listingStatus('from_status'),
    toStatus: listingStatus('to_status').notNull(),
    reason: varchar('reason', {length: 240}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    index('listing_status_history_listing_created_idx').on(table.listingId, table.createdAt)
  ]
);

export const moderationCaseStatus = pgEnum('moderation_case_status', [
  'open',
  'approved',
  'rejected'
]);
export const moderationRiskBand = pgEnum('moderation_risk_band', [
  'unassessed',
  'low',
  'medium',
  'high'
]);
export const moderationActionType = pgEnum('moderation_action_type', ['approve', 'reject']);

export const moderationCase = pgTable(
  'moderation_case',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'restrict'}),
    status: moderationCaseStatus('status').default('open').notNull(),
    priority: smallint('priority').default(0).notNull(),
    riskBand: moderationRiskBand('risk_band').default('unassessed').notNull(),
    policyVersion: varchar('policy_version', {length: 80}).notNull(),
    assignedTo: uuid('assigned_to').references(() => user.id, {onDelete: 'restrict'}),
    openedAt: timestamp('opened_at', {withTimezone: true}).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('moderation_case_listing_unique').on(table.listingId),
    index('moderation_case_queue_idx').on(table.status, table.priority, table.openedAt),
    index('moderation_case_assignee_idx').on(table.assignedTo, table.status, table.updatedAt),
    check('moderation_case_priority_range', sql`${table.priority} between 0 and 1000`),
    check(
      'moderation_case_resolution_consistent',
      sql`(${table.status} = 'open' and ${table.resolvedAt} is null) or (${table.status} <> 'open' and ${table.resolvedAt} is not null)`
    )
  ]
);

export const moderationAction = pgTable(
  'moderation_action',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCase.id, {onDelete: 'restrict'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    action: moderationActionType('action').notNull(),
    reasonCode: varchar('reason_code', {length: 80}).notNull(),
    publicExplanation: varchar('public_explanation', {length: 500}),
    internalNote: text('internal_note'),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    index('moderation_action_case_created_idx').on(table.caseId, table.createdAt),
    index('moderation_action_actor_created_idx').on(table.actorId, table.createdAt),
    check('moderation_action_reason_code_format', sql`${table.reasonCode} ~ '^[a-z0-9_]{3,80}$'`),
    check(
      'moderation_action_rejection_has_explanation',
      sql`${table.action} <> 'reject' or (${table.publicExplanation} is not null and length(btrim(${table.publicExplanation})) >= 10)`
    )
  ]
);

export const favoriteListing = pgTable(
  'favorite_listing',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    primaryKey({columns: [table.userId, table.listingId]}),
    index('favorite_listing_user_created_idx').on(table.userId, table.createdAt),
    index('favorite_listing_listing_idx').on(table.listingId)
  ]
);

export type SavedSearchFilterSnapshot =
  | {type: 'options'; attributeId: string; optionIds: string[]}
  | {type: 'numeric'; attributeId: string; min?: number; max?: number}
  | {type: 'boolean'; attributeId: string; value: boolean};

export const savedSearch = pgTable(
  'saved_search',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    name: varchar('name', {length: 100}).notNull(),
    locale: varchar('locale', {length: 8})
      .notNull()
      .references(() => supportedLocale.code, {onDelete: 'restrict'}),
    queryText: varchar('query_text', {length: 120}).default('').notNull(),
    categoryId: uuid('category_id').references(() => category.id, {onDelete: 'restrict'}),
    locationId: uuid('location_id').references(() => location.id, {onDelete: 'restrict'}),
    priceMinMinor: bigint('price_min_minor', {mode: 'number'}),
    priceMaxMinor: bigint('price_max_minor', {mode: 'number'}),
    sort: varchar('sort', {length: 20}).default('newest').notNull(),
    filters: jsonb('filters').$type<SavedSearchFilterSnapshot[]>().default([]).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex('saved_search_owner_name_unique').on(table.ownerId, table.name),
    index('saved_search_owner_updated_idx').on(table.ownerId, table.updatedAt),
    index('saved_search_category_idx').on(table.categoryId),
    index('saved_search_location_idx').on(table.locationId),
    check('saved_search_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check(
      'saved_search_price_min_non_negative',
      sql`${table.priceMinMinor} is null or ${table.priceMinMinor} >= 0`
    ),
    check(
      'saved_search_price_max_non_negative',
      sql`${table.priceMaxMinor} is null or ${table.priceMaxMinor} >= 0`
    ),
    check(
      'saved_search_price_range_valid',
      sql`${table.priceMinMinor} is null or ${table.priceMaxMinor} is null or ${table.priceMinMinor} <= ${table.priceMaxMinor}`
    ),
    check(
      'saved_search_sort_valid',
      sql`${table.sort} in ('relevance', 'newest', 'price_asc', 'price_desc')`
    ),
    check('saved_search_filters_array', sql`jsonb_typeof(${table.filters}) = 'array'`)
  ]
);

export const listingContactAccess = pgTable(
  'listing_contact_access',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
    accessCount: integer('access_count').default(1).notNull(),
    firstAccessedAt: timestamp('first_accessed_at', {withTimezone: true}).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('listing_contact_access_buyer_listing_unique').on(table.buyerId, table.listingId),
    index('listing_contact_access_buyer_recent_idx').on(table.buyerId, table.lastAccessedAt),
    index('listing_contact_access_seller_recent_idx').on(table.sellerId, table.lastAccessedAt),
    check('listing_contact_access_count_positive', sql`${table.accessCount} > 0`),
    check('listing_contact_access_not_self', sql`${table.buyerId} <> ${table.sellerId}`),
    check(
      'listing_contact_access_time_order',
      sql`${table.firstAccessedAt} <= ${table.lastAccessedAt}`
    )
  ]
);

export const outboxEvent = pgTable(
  'outbox_event',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    aggregateType: varchar('aggregate_type', {length: 80}).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', {length: 120}).notNull(),
    aggregateVersion: integer('aggregate_version').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp('occurred_at', {withTimezone: true}).defaultNow().notNull(),
    availableAt: timestamp('available_at', {withTimezone: true}).defaultNow().notNull(),
    processedAt: timestamp('processed_at', {withTimezone: true}),
    attempts: integer('attempts').default(0).notNull(),
    leasedAt: timestamp('leased_at', {withTimezone: true}),
    leaseOwner: varchar('lease_owner', {length: 100}),
    lastError: varchar('last_error', {length: 240})
  },
  (table) => [
    index('outbox_pending_idx').on(table.processedAt, table.availableAt, table.occurredAt),
    index('outbox_aggregate_idx').on(
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion
    ),
    check('outbox_version_positive', sql`${table.aggregateVersion} > 0`),
    check('outbox_attempts_non_negative', sql`${table.attempts} >= 0`)
  ]
);

export const mediaAssetStatus = pgEnum('media_asset_status', [
  'pending_upload',
  'quarantined',
  'processing',
  'ready',
  'rejected',
  'deleted'
]);

export const mediaVariantKind = pgEnum('media_variant_kind', ['thumbnail', 'card', 'detail']);

export const mediaAsset = pgTable(
  'media_asset',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    status: mediaAssetStatus('status').default('pending_upload').notNull(),
    quarantineObjectKey: varchar('quarantine_object_key', {length: 500}).notNull(),
    declaredMediaType: varchar('declared_media_type', {length: 80}).notNull(),
    detectedMediaType: varchar('detected_media_type', {length: 80}),
    expectedBytes: bigint('expected_bytes', {mode: 'number'}).notNull(),
    actualBytes: bigint('actual_bytes', {mode: 'number'}),
    expectedSha256: varchar('expected_sha256', {length: 64}).notNull(),
    actualSha256: varchar('actual_sha256', {length: 64}),
    width: integer('width'),
    height: integer('height'),
    rejectionCode: varchar('rejection_code', {length: 80}),
    uploadExpiresAt: timestamp('upload_expires_at', {withTimezone: true}).notNull(),
    uploadedAt: timestamp('uploaded_at', {withTimezone: true}),
    processedAt: timestamp('processed_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('media_asset_quarantine_key_unique').on(table.quarantineObjectKey),
    index('media_asset_owner_status_created_idx').on(table.ownerId, table.status, table.createdAt),
    index('media_asset_expired_upload_idx').on(table.status, table.uploadExpiresAt),
    check('media_asset_expected_bytes_range', sql`${table.expectedBytes} between 1 and 10485760`),
    check(
      'media_asset_actual_bytes_range',
      sql`${table.actualBytes} is null or ${table.actualBytes} between 1 and 10485760`
    ),
    check('media_asset_expected_sha256_format', sql`${table.expectedSha256} ~ '^[0-9a-f]{64}$'`),
    check(
      'media_asset_actual_sha256_format',
      sql`${table.actualSha256} is null or ${table.actualSha256} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      'media_asset_dimensions_together',
      sql`(${table.width} is null and ${table.height} is null) or (${table.width} > 0 and ${table.height} > 0)`
    )
  ]
);

export const listingDraftMedia = pgTable(
  'listing_draft_media',
  {
    draftId: uuid('draft_id')
      .notNull()
      .references(() => listingDraft.id, {onDelete: 'cascade'}),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAsset.id, {onDelete: 'restrict'}),
    sortOrder: smallint('sort_order').notNull(),
    isCover: boolean('is_cover').default(false).notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.draftId, table.mediaAssetId]}),
    uniqueIndex('listing_draft_media_asset_unique').on(table.mediaAssetId),
    uniqueIndex('listing_draft_media_order_unique').on(table.draftId, table.sortOrder),
    uniqueIndex('listing_draft_media_single_cover_unique')
      .on(table.draftId)
      .where(sql`${table.isCover} = true`),
    check('listing_draft_media_order_range', sql`${table.sortOrder} between 0 and 11`)
  ]
);

export const mediaVariant = pgTable(
  'media_variant',
  {
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAsset.id, {onDelete: 'cascade'}),
    kind: mediaVariantKind('kind').notNull(),
    objectKey: varchar('object_key', {length: 500}).notNull(),
    mediaType: varchar('media_type', {length: 80}).notNull(),
    bytes: bigint('bytes', {mode: 'number'}).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.mediaAssetId, table.kind]}),
    uniqueIndex('media_variant_object_key_unique').on(table.objectKey),
    check('media_variant_bytes_positive', sql`${table.bytes} > 0`),
    check('media_variant_dimensions_positive', sql`${table.width} > 0 and ${table.height} > 0`)
  ]
);

export const listingMedia = pgTable(
  'listing_media',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'cascade'}),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAsset.id, {onDelete: 'restrict'}),
    sortOrder: smallint('sort_order').notNull(),
    isCover: boolean('is_cover').default(false).notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({columns: [table.listingId, table.mediaAssetId]}),
    uniqueIndex('listing_media_asset_unique').on(table.mediaAssetId),
    uniqueIndex('listing_media_order_unique').on(table.listingId, table.sortOrder),
    uniqueIndex('listing_media_single_cover_unique')
      .on(table.listingId)
      .where(sql`${table.isCover} = true`),
    check('listing_media_order_range', sql`${table.sortOrder} between 0 and 11`)
  ]
);
