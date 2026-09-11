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
    uniqueIndex('listing_id_seller_unique').on(table.id, table.sellerId),
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
export const moderationSignalCode = pgEnum('moderation_signal_code', [
  'new_account',
  'contact_details_in_content'
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

export const moderationCaseSignal = pgTable(
  'moderation_case_signal',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => moderationCase.id, {onDelete: 'restrict'}),
    code: moderationSignalCode('code').notNull(),
    weight: smallint('weight').notNull(),
    policyVersion: varchar('policy_version', {length: 80}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('moderation_case_signal_case_code_unique').on(table.caseId, table.code),
    index('moderation_case_signal_case_created_idx').on(table.caseId, table.createdAt),
    check('moderation_case_signal_weight_range', sql`${table.weight} between 1 and 1000`)
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

export const listingReportReason = pgEnum('listing_report_reason', [
  'fraud',
  'wrong_category',
  'prohibited_item',
  'duplicate',
  'misleading_price',
  'stale_listing',
  'other'
]);
export const listingReportStatus = pgEnum('listing_report_status', [
  'open',
  'dismissed',
  'resolved'
]);
export const listingReportActionType = pgEnum('listing_report_action_type', [
  'dismiss',
  'remove_listing'
]);

export const listingReport = pgTable(
  'listing_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'restrict'}),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    reason: listingReportReason('reason').notNull(),
    details: varchar('details', {length: 1000}),
    status: listingReportStatus('status').default('open').notNull(),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('listing_report_reporter_listing_unique').on(table.reporterId, table.listingId),
    index('listing_report_queue_idx').on(table.status, table.createdAt, table.id),
    index('listing_report_listing_status_idx').on(table.listingId, table.status, table.createdAt),
    index('listing_report_reporter_created_idx').on(table.reporterId, table.createdAt),
    check(
      'listing_report_details_length',
      sql`${table.details} is null or length(btrim(${table.details})) between 10 and 1000`
    ),
    check(
      'listing_report_resolution_consistent',
      sql`(${table.status} = 'open' and ${table.resolvedAt} is null) or (${table.status} <> 'open' and ${table.resolvedAt} is not null)`
    )
  ]
);

export const listingReportAction = pgTable(
  'listing_report_action',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => listingReport.id, {onDelete: 'restrict'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    action: listingReportActionType('action').notNull(),
    internalNote: varchar('internal_note', {length: 2000}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('listing_report_action_report_unique').on(table.reportId),
    index('listing_report_action_actor_created_idx').on(table.actorId, table.createdAt)
  ]
);

export const listingAppealStatus = pgEnum('listing_appeal_status', [
  'open',
  'accepted',
  'rejected'
]);
export const listingAppealActionType = pgEnum('listing_appeal_action_type', ['accept', 'reject']);

export const listingAppeal = pgTable(
  'listing_appeal',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'restrict'}),
    moderationActionId: uuid('moderation_action_id')
      .notNull()
      .references(() => moderationAction.id, {onDelete: 'restrict'}),
    appellantId: uuid('appellant_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    statement: varchar('statement', {length: 1000}).notNull(),
    status: listingAppealStatus('status').default('open').notNull(),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('listing_appeal_moderation_action_unique').on(table.moderationActionId),
    uniqueIndex('listing_appeal_one_open_per_listing_unique')
      .on(table.listingId)
      .where(sql`${table.status} = 'open'`),
    index('listing_appeal_queue_idx').on(table.status, table.createdAt, table.id),
    index('listing_appeal_appellant_created_idx').on(table.appellantId, table.createdAt),
    check(
      'listing_appeal_statement_length',
      sql`length(btrim(${table.statement})) between 20 and 1000`
    ),
    check(
      'listing_appeal_resolution_consistent',
      sql`(${table.status} = 'open' and ${table.resolvedAt} is null) or (${table.status} <> 'open' and ${table.resolvedAt} is not null)`
    )
  ]
);

export const listingAppealAction = pgTable(
  'listing_appeal_action',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appealId: uuid('appeal_id')
      .notNull()
      .references(() => listingAppeal.id, {onDelete: 'restrict'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    action: listingAppealActionType('action').notNull(),
    publicResponse: varchar('public_response', {length: 500}),
    internalNote: varchar('internal_note', {length: 2000}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('listing_appeal_action_appeal_unique').on(table.appealId),
    index('listing_appeal_action_actor_created_idx').on(table.actorId, table.createdAt),
    check(
      'listing_appeal_rejection_has_response',
      sql`${table.action} <> 'reject' or (${table.publicResponse} is not null and length(btrim(${table.publicResponse})) >= 10)`
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

export const conversationStatus = pgEnum('conversation_status', ['open', 'closed']);

export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id').notNull(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    status: conversationStatus('status').default('open').notNull(),
    lastMessageSequence: integer('last_message_sequence').default(0).notNull(),
    buyerReadSequence: integer('buyer_read_sequence').default(0).notNull(),
    sellerReadSequence: integer('seller_read_sequence').default(0).notNull(),
    lastMessageAt: timestamp('last_message_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    foreignKey({
      columns: [table.listingId, table.sellerId],
      foreignColumns: [listing.id, listing.sellerId],
      name: 'conversation_listing_seller_fk'
    }).onDelete('restrict'),
    unique('conversation_identity_unique').on(
      table.id,
      table.listingId,
      table.buyerId,
      table.sellerId
    ),
    uniqueIndex('conversation_listing_buyer_unique').on(table.listingId, table.buyerId),
    index('conversation_buyer_recent_idx').on(table.buyerId, table.lastMessageAt, table.id),
    index('conversation_seller_recent_idx').on(table.sellerId, table.lastMessageAt, table.id),
    check('conversation_participants_distinct', sql`${table.buyerId} <> ${table.sellerId}`),
    check(
      'conversation_sequence_non_negative',
      sql`${table.lastMessageSequence} >= 0 and ${table.buyerReadSequence} >= 0 and ${table.sellerReadSequence} >= 0`
    ),
    check(
      'conversation_read_sequences_bounded',
      sql`${table.buyerReadSequence} <= ${table.lastMessageSequence} and ${table.sellerReadSequence} <= ${table.lastMessageSequence}`
    ),
    check(
      'conversation_last_message_consistent',
      sql`(${table.lastMessageSequence} = 0 and ${table.lastMessageAt} is null) or (${table.lastMessageSequence} > 0 and ${table.lastMessageAt} is not null)`
    )
  ]
);

export const conversationMessage = pgTable(
  'conversation_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, {onDelete: 'cascade'}),
    sequence: integer('sequence').notNull(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    clientMessageId: uuid('client_message_id').notNull(),
    body: varchar('body', {length: 2000}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('conversation_message_sequence_unique').on(table.conversationId, table.sequence),
    uniqueIndex('conversation_message_client_unique').on(
      table.conversationId,
      table.senderId,
      table.clientMessageId
    ),
    index('conversation_message_sender_recent_idx').on(table.senderId, table.createdAt),
    check('conversation_message_sequence_positive', sql`${table.sequence} > 0`),
    check(
      'conversation_message_body_length',
      sql`char_length(btrim(${table.body})) between 1 and 2000`
    )
  ]
);

export const reviewStatus = pgEnum('review_status', ['active', 'hidden']);

export const qualifiedInteraction = pgTable(
  'qualified_interaction',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listing.id, {onDelete: 'restrict'}),
    conversationId: uuid('conversation_id').notNull(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    qualifiedBy: uuid('qualified_by')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    qualifiedAt: timestamp('qualified_at', {withTimezone: true}).defaultNow().notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.listingId, table.buyerId, table.sellerId],
      foreignColumns: [
        conversation.id,
        conversation.listingId,
        conversation.buyerId,
        conversation.sellerId
      ],
      name: 'qualified_interaction_conversation_identity_fk'
    }).onDelete('restrict'),
    uniqueIndex('qualified_interaction_listing_unique').on(table.listingId),
    uniqueIndex('qualified_interaction_conversation_unique').on(table.conversationId),
    index('qualified_interaction_buyer_recent_idx').on(table.buyerId, table.qualifiedAt),
    index('qualified_interaction_seller_recent_idx').on(table.sellerId, table.qualifiedAt),
    check(
      'qualified_interaction_participants_distinct',
      sql`${table.buyerId} <> ${table.sellerId}`
    ),
    check(
      'qualified_interaction_qualified_by_seller',
      sql`${table.qualifiedBy} = ${table.sellerId}`
    )
  ]
);

export const userReview = pgTable(
  'user_review',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    interactionId: uuid('interaction_id')
      .notNull()
      .references(() => qualifiedInteraction.id, {onDelete: 'restrict'}),
    authorId: uuid('author_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    rating: smallint('rating').notNull(),
    body: varchar('body', {length: 1000}),
    status: reviewStatus('status').default('active').notNull(),
    revealAt: timestamp('reveal_at', {withTimezone: true}).notNull(),
    hiddenAt: timestamp('hidden_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('user_review_interaction_author_unique').on(table.interactionId, table.authorId),
    index('user_review_subject_visibility_idx').on(
      table.subjectId,
      table.status,
      table.revealAt,
      table.createdAt
    ),
    index('user_review_author_recent_idx').on(table.authorId, table.createdAt),
    check('user_review_rating_range', sql`${table.rating} between 1 and 5`),
    check('user_review_participants_distinct', sql`${table.authorId} <> ${table.subjectId}`),
    check(
      'user_review_body_length',
      sql`${table.body} is null or char_length(btrim(${table.body})) between 10 and 1000`
    ),
    check(
      'user_review_hidden_consistent',
      sql`(${table.status} = 'active' and ${table.hiddenAt} is null) or (${table.status} = 'hidden' and ${table.hiddenAt} is not null)`
    ),
    check('user_review_reveal_after_creation', sql`${table.revealAt} >= ${table.createdAt}`)
  ]
);

export const reviewReportReason = pgEnum('review_report_reason', [
  'spam',
  'harassment',
  'personal_data',
  'irrelevant',
  'prohibited_content',
  'other'
]);
export const reviewReportStatus = pgEnum('review_report_status', ['open', 'dismissed', 'resolved']);
export const reviewReportActionType = pgEnum('review_report_action_type', [
  'dismiss',
  'hide_review'
]);

export const reviewReport = pgTable(
  'review_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => userReview.id, {onDelete: 'restrict'}),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    reason: reviewReportReason('reason').notNull(),
    details: varchar('details', {length: 1000}),
    status: reviewReportStatus('status').default('open').notNull(),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('review_report_reporter_review_unique').on(table.reporterId, table.reviewId),
    index('review_report_queue_idx').on(table.status, table.createdAt, table.id),
    index('review_report_review_status_idx').on(table.reviewId, table.status, table.createdAt),
    index('review_report_reporter_created_idx').on(table.reporterId, table.createdAt),
    check(
      'review_report_details_length',
      sql`${table.details} is null or length(btrim(${table.details})) between 10 and 1000`
    ),
    check(
      'review_report_resolution_consistent',
      sql`(${table.status} = 'open' and ${table.resolvedAt} is null) or (${table.status} <> 'open' and ${table.resolvedAt} is not null)`
    )
  ]
);

export const reviewReportAction = pgTable(
  'review_report_action',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reviewReport.id, {onDelete: 'restrict'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    action: reviewReportActionType('action').notNull(),
    internalNote: varchar('internal_note', {length: 2000}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('review_report_action_report_unique').on(table.reportId),
    index('review_report_action_actor_created_idx').on(table.actorId, table.createdAt)
  ]
);

export const messageReportReason = pgEnum('message_report_reason', [
  'spam',
  'fraud',
  'harassment',
  'prohibited_content',
  'personal_data',
  'other'
]);
export const messageReportStatus = pgEnum('message_report_status', [
  'open',
  'dismissed',
  'resolved'
]);
export const messageReportActionType = pgEnum('message_report_action_type', [
  'dismiss',
  'close_conversation'
]);

export const messageReport = pgTable(
  'message_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => conversationMessage.id, {onDelete: 'restrict'}),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    reason: messageReportReason('reason').notNull(),
    details: varchar('details', {length: 1000}),
    status: messageReportStatus('status').default('open').notNull(),
    resolvedAt: timestamp('resolved_at', {withTimezone: true}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('message_report_reporter_message_unique').on(table.reporterId, table.messageId),
    index('message_report_queue_idx').on(table.status, table.createdAt, table.id),
    index('message_report_message_status_idx').on(table.messageId, table.status, table.createdAt),
    index('message_report_reporter_created_idx').on(table.reporterId, table.createdAt),
    check(
      'message_report_details_length',
      sql`${table.details} is null or length(btrim(${table.details})) between 10 and 1000`
    ),
    check(
      'message_report_resolution_consistent',
      sql`(${table.status} = 'open' and ${table.resolvedAt} is null) or (${table.status} <> 'open' and ${table.resolvedAt} is not null)`
    )
  ]
);

export const messageReportAction = pgTable(
  'message_report_action',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => messageReport.id, {onDelete: 'restrict'}),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict'}),
    action: messageReportActionType('action').notNull(),
    internalNote: varchar('internal_note', {length: 2000}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('message_report_action_report_unique').on(table.reportId),
    index('message_report_action_actor_created_idx').on(table.actorId, table.createdAt)
  ]
);

export const userBlock = pgTable(
  'user_block',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    primaryKey({columns: [table.blockerId, table.blockedId]}),
    index('user_block_blocked_idx').on(table.blockedId, table.createdAt),
    check('user_block_not_self', sql`${table.blockerId} <> ${table.blockedId}`)
  ]
);

export const notificationType = pgEnum('notification_type', ['chat_message']);
export const notificationChannel = pgEnum('notification_channel', ['in_app', 'email', 'push']);
export const notificationDeliveryStatus = pgEnum('notification_delivery_status', [
  'pending',
  'processing',
  'delivered',
  'failed',
  'skipped'
]);

export const notificationPreference = pgTable(
  'notification_preference',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    type: notificationType('type').notNull(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    emailEnabled: boolean('email_enabled').default(false).notNull(),
    pushEnabled: boolean('push_enabled').default(false).notNull(),
    ...timestamps
  },
  (table) => [primaryKey({columns: [table.userId, table.type]})]
);

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    type: notificationType('type').notNull(),
    actorId: uuid('actor_id').references(() => user.id, {onDelete: 'restrict'}),
    listingId: uuid('listing_id').references(() => listing.id, {onDelete: 'cascade'}),
    conversationId: uuid('conversation_id').references(() => conversation.id, {
      onDelete: 'cascade'
    }),
    messageId: uuid('message_id').references(() => conversationMessage.id, {onDelete: 'cascade'}),
    readAt: timestamp('read_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex('notification_recipient_message_unique').on(table.recipientId, table.messageId),
    index('notification_recipient_unread_idx').on(table.recipientId, table.readAt, table.createdAt),
    check(
      'notification_chat_references_required',
      sql`${table.type} <> 'chat_message' or (${table.actorId} is not null and ${table.listingId} is not null and ${table.conversationId} is not null and ${table.messageId} is not null)`
    ),
    check(
      'notification_actor_not_recipient',
      sql`${table.actorId} is null or ${table.actorId} <> ${table.recipientId}`
    )
  ]
);

export const notificationDelivery = pgTable(
  'notification_delivery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notification.id, {onDelete: 'cascade'}),
    channel: notificationChannel('channel').notNull(),
    status: notificationDeliveryStatus('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    availableAt: timestamp('available_at', {withTimezone: true}).defaultNow().notNull(),
    leasedAt: timestamp('leased_at', {withTimezone: true}),
    leaseOwner: varchar('lease_owner', {length: 100}),
    deliveredAt: timestamp('delivered_at', {withTimezone: true}),
    providerMessageId: varchar('provider_message_id', {length: 240}),
    lastError: varchar('last_error', {length: 240}),
    ...timestamps
  },
  (table) => [
    uniqueIndex('notification_delivery_channel_unique').on(table.notificationId, table.channel),
    index('notification_delivery_pending_idx').on(table.status, table.availableAt, table.createdAt),
    check('notification_delivery_attempts_non_negative', sql`${table.attempts} >= 0`),
    check(
      'notification_delivery_delivered_at_consistent',
      sql`${table.status} <> 'delivered' or ${table.deliveredAt} is not null`
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
