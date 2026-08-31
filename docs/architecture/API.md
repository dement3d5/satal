# API

## Contract

Public/mobile-capable operations live under `/api/v1`. JSON uses a consistent envelope for data, pagination and errors. Contracts are defined with shared Zod schemas and can generate OpenAPI documentation. Route handlers remain thin adapters to application services.

## Conventions

- cursor pagination for feeds/messages; stable page-based URLs may be used for SEO category pages;
- explicit locale and timezone rules; money returned as currency plus integer minor units;
- problem-style errors with stable machine code, safe human message, field errors and correlation ID;
- idempotency keys for publication, payment and other retry-sensitive mutations;
- conditional requests/caching only for public non-sensitive resources;
- server-side authorization and object ownership on every protected operation.

## Versioning

Backward-compatible additions remain in v1. Breaking contract changes require `/api/v2` and a migration/deprecation window. Internal UI actions may evolve faster but cannot contain unique business logic.

## Initial resources

Sessions/auth, profile, locations, categories/attributes, listing drafts/listings/media, search/suggestions, favorites/saved searches, conversations/messages, notifications, reports and admin moderation.

Rate limits are endpoint- and actor-specific. Login/OTP/recovery, uploads, search, chat, reports, listing creation and payment actions each receive distinct policies.

## Phase 3 contracts

The initial marketplace API slice exposes PostgreSQL-backed category trees, localized attribute schemas and geography under `/api/v1/catalog` and `/api/v1/locations`. Category schema responses include validation constraints, options and filter/search/sort capabilities so clients never hardcode category-specific forms.

Authenticated draft routes under `/api/v1/listing-drafts` support creation, owner-only reads, autosave and safe category changes. Draft updates require the last observed `version`; stale autosaves receive a conflict response instead of overwriting newer work. Category-change responses report removed attribute IDs so the UI can explain recalculation without duplicating catalog rules. Draft responses are private and use `no-store`; public catalog and geography reads have short shared-cache policies.

`POST /api/v1/listing-drafts/{draftId}/publish` is owner-only, version-checked and idempotent through the unique source-draft relationship. It reruns server-side completeness and category-schema validation before creating an active PostgreSQL snapshot and outbox event.

`GET /api/v1/listings` exposes newest-first cursor pagination with optional category/location bounds. `GET /api/v1/listings/{listingId}` exposes only active listings with localized category, location and attribute labels. Public responses use short shared-cache headers; private draft/publication responses use `no-store`.

## Media contracts

`GET|POST|PATCH /api/v1/listing-drafts/{draftId}/media` lists media, authorizes a new upload and atomically changes order/cover. `DELETE /api/v1/listing-drafts/{draftId}/media/{assetId}` detaches owner-controlled media before submission. These routes authenticate the session and re-check draft ownership and lifecycle server-side.

Authorization declares an allowed MIME type, exact byte count and lowercase SHA-256 digest. The server returns a ten-minute single-asset capability. `PUT /api/v1/media/{assetId}/content` accepts a bounded, uncompressed body with the capability in `x-satal-upload-token`, verifies its signature, expiry, byte count, digest and magic bytes, and stores it only in quarantine. The capability is consumed once. The response status `quarantined` does not imply that the image is publicly safe or available.

`GET /api/v1/media/{assetId}/variants/{kind}` serves immutable `thumbnail`, `card` or `detail` bytes only when the asset is `ready`, attached to an active listing and the requested variant exists. It never serves originals, quarantine data or draft-only media.

## Search contracts

`GET /api/v1/search` accepts `locale`, `q`, `categoryId`, `locationId`, `priceMin`, `priceMax`, `sort`, `page` and `limit`. Schema-driven filters use `f.{attributeId}` for select option IDs, `b.{attributeId}` for booleans and `n.{attributeId}.min|max` for numeric/measurement bounds. Attribute filters require a category and are checked against PostgreSQL applicability/type rules before either search adapter runs.

The response contains authoritative public cards plus `total`, `page`, `limit`, `source` and `degraded`. Typesense returns only ordered listing IDs; PostgreSQL rehydrates and rechecks active visibility. Public responses have a short shared-cache policy.
