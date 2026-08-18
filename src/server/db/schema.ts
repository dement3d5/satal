import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

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
