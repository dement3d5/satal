# Data model

PostgreSQL is the source of truth. Tables use stable UUID identifiers, UTC timestamps, explicit constraints and foreign keys. Money uses integer minor units and an explicit currency. Lifecycle state is modeled rather than inferred.

## Phase 3 implemented aggregates

### Geography

- `location`: adjacency-list hierarchy with stable slug, kind, depth, source identity and verification timestamp;
- `location_translation`: required localized names by locale;
- `location_alias`: normalized lookup aliases without changing canonical names.

Kinds cover country, economic region, city, district, settlement, neighborhood, metro and street. The model is intentionally broader than the dev dataset. Parent/kind/depth validation occurs at import/application boundaries; database checks enforce root consistency and bounded depth.

The committed `data/geography/dev.az.json` is illustrative and explicitly unverified. It contains Azerbaijan, Bakı, Gəncə, Yasamal, İçərişəhər neighborhood and İçərişəhər metro only. A reviewed authoritative production dataset, license, translations and import verification record are a launch prerequisite.

Listing drafts reference a canonical location and a public precision (`city`, `district` or `neighborhood`). A private seller's exact address is neither required nor stored as a public listing field. Business address and private delivery/contact details require separate later privacy-reviewed models.

### Taxonomy

- `category`: stable locale-independent slug, parent, explicit depth, schema version and ordering;
- `category_translation`: AZ/RU/EN name and optional description;
- `category_attribute`: applicability plus required/filterable/searchable/sortable and render order.

Categories have at most three real levels (`depth` 0–2). Brands, models and similar product dimensions are attributes, not child categories. Parent-depth consistency is validated by the catalog application boundary; the database rejects a fourth level and malformed roots.

### Dynamic attributes

- `attribute_definition`: type, unit and structured validation columns;
- `attribute_translation`: localized label/help text;
- `attribute_option` and `attribute_option_translation`: normalized select choices;
- `category_attribute`: category-specific behavior and ordering;
- `listing_draft_attribute_value`: one typed scalar value per draft/attribute;
- `listing_draft_attribute_option_value`: normalized multi-select choices.

Supported types are text, integer, decimal, boolean, single-select, multi-select, date and measurement. Constraints include numeric bounds, text length/pattern, selection bounds and measurement unit. A database check requires exactly one scalar column, and composite option foreign keys prevent using an option from another attribute.

This is a typed EAV hybrid, not an uncontrolled JSON document. Structural metadata, applicability, translations, options and draft values remain relational and queryable. APIs may construct a compact JSON read projection, and a future Typesense index may receive a denormalized projection, but neither becomes authoritative.

### Listing drafts

- `listing_draft`: owner, category/schema version, location/privacy precision, editable fields, status, optimistic version and autosave timestamp;
- `listing_draft_attribute_value` and `listing_draft_attribute_option_value`: typed values;
- `listing_draft_status_history`: actor-attributed lifecycle audit.

Draft lifecycle is `draft → ready_for_review → submitted`, with explicit abandon/restore transitions. Only the owner may mutate a draft. Autosave uses the positive `version` as an optimistic concurrency token and updates `last_autosaved_at`.

Changing category is allowed only before submission. The application transaction loads the new `category_attribute` schema, retains values that are still applicable and valid, deletes incompatible scalar/multi-select rows, updates category/schema version, resets `ready_for_review` to `draft`, increments the draft version and records the change. Required-field completeness is evaluated against the captured category schema version before transition to review.

## Constraints and indexes

- uniqueness for slugs, source identities, translation keys, attribute keys and option keys;
- restrictive ownership/category/location foreign keys and cascading draft value/history cleanup;
- category depth 0–2, positive schema/draft versions and non-negative price;
- owner/status/update index for "my drafts" and autosave recovery;
- category/status and location indexes for later operational/publication workflows;
- category attribute render/projection indexes and typed option projection indexes;
- localized location name/alias indexes for future geography lookup.

### Published listings

- `listing`: immutable publication snapshot identity plus seller, category/schema version, privacy-coarsened location, lifecycle, price and publication/expiry timestamps;
- `listing_attribute_value` and `listing_attribute_option_value`: normalized typed attribute snapshot copied from the validated draft;
- `listing_status_history`: actor-attributed public lifecycle audit;
- `outbox_event`: transactional, versioned integration events with availability, expiring worker lease, attempts and safe last-error metadata for search/media/notification workers.

Publication locks the source draft, authorizes its owner, checks the optimistic version, validates required content and every category attribute, resolves the selected draft location to a safe public ancestor, copies the snapshot, advances the draft to `submitted`, and writes `listing.published` to the outbox in one transaction. `listing.source_draft_id` is unique, making a repeated publication request idempotent. Only `active` listings are public. Typesense is never queried to decide publication or visibility.

The public lifecycle supports `pending_review`, `active`, `sold`, `expired`, `removed` and `rejected`. The current low-risk path activates a structurally valid listing immediately while retaining complete history; risk-based moderation and administrative transitions remain Phase 4.

Active listings have a partial GIN full-text index over title and description for degraded PostgreSQL search. Typesense documents are derived projections only: IDs, localized searchable text, ancestor scopes and typed facet values can always be rebuilt from these relational tables. Public search results are rehydrated through the active-listing query before exposure.

### Favorites and saved searches

- `favorite_listing`: owner/listing relationship with a composite primary key and reverse/list-order indexes;
- `saved_search`: owner, localized name, locale, typed core query columns, bounded dynamic filter snapshot and timestamps.

Deleting a user or listing cascades its favorites. Saved searches cascade with the owner but restrict deletion of referenced category, location and locale records. Name uniqueness is scoped to the owner, prices are non-negative and ordered, sort values are constrained, and filters must be a JSON array.

The model is deliberately hybrid. Frequently queried core fields (`query_text`, category, location, price bounds and sort) remain relational. Only the category-defined dynamic filter union is stored as validated JSONB because its keys vary with taxonomy. Creation always passes through the public search parser and verifies referenced enabled records; arbitrary client JSON is never persisted. See ADR 0006.

### Identity and contact access

Better Auth owns `user`, `account`, `session` and `verification`. Credential accounts use the framework's password hashing and the unique `(provider_id, account_id)` identity. The legacy optional `issuer` field remains for compatibility but is not authoritative.

`listing_contact_access` stores buyer, seller, listing, first/last access timestamps and a positive retry count. One row exists per buyer/listing. Foreign keys cascade when the user or listing is deleted; a database check prevents self-contact. The application serializes requests per buyer with a row lock before enforcing the distinct-contact window and upserting the audit. The phone itself is not copied into the audit table.

### Listing media

- `media_asset`: owner, quarantine key, declared/observed byte metadata, SHA-256 digests, processing timestamps and lifecycle;
- `listing_draft_media`: ordered draft attachment with one cover and a maximum of 12 positions;
- `media_variant`: normalized thumbnail/card/detail object metadata created only by the processor;
- `listing_media`: publication attachment/order copied in the publication transaction.

The lifecycle is `pending_upload → quarantined → processing → ready`, with terminal `rejected` and `deleted` states. PostgreSQL is authoritative for ownership, attachment and readiness; object storage contains opaque bytes and cannot make an asset public by itself. Unique order/cover constraints prevent ambiguous presentation, and an asset can belong to only one draft/listing aggregate in the current MVP. Publishing copies attachment references even when processing is pending, so an asynchronous worker can expose verified variants later without mutating the listing snapshot.
