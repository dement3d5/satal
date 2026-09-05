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

`POST /api/v1/listing-drafts/{draftId}/publish` is owner-only, version-checked and idempotent through the unique source-draft relationship. It reruns server-side completeness and category-schema validation before creating a `pending_review` PostgreSQL snapshot and moderation case.

`GET /api/v1/listings` exposes newest-first cursor pagination with optional category/location bounds. `GET /api/v1/listings/{listingId}` exposes only active listings with localized category, location and attribute labels. Public responses use short shared-cache headers; private draft/publication responses use `no-store`.

## Media contracts

`GET|POST|PATCH /api/v1/listing-drafts/{draftId}/media` lists media, authorizes a new upload and atomically changes order/cover. `DELETE /api/v1/listing-drafts/{draftId}/media/{assetId}` detaches owner-controlled media before submission. These routes authenticate the session and re-check draft ownership and lifecycle server-side.

Authorization declares an allowed MIME type, exact byte count and lowercase SHA-256 digest. The server returns a ten-minute single-asset capability. `PUT /api/v1/media/{assetId}/content` accepts a bounded, uncompressed body with the capability in `x-satal-upload-token`, verifies its signature, expiry, byte count, digest and magic bytes, and stores it only in quarantine. The capability is consumed once. The response status `quarantined` does not imply that the image is publicly safe or available.

`GET /api/v1/media/{assetId}/variants/{kind}` serves immutable `thumbnail`, `card` or `detail` bytes only when the asset is `ready`, attached to an active listing and the requested variant exists. It never serves originals, quarantine data or draft-only media.

## Search contracts

`GET /api/v1/search` accepts `locale`, `q`, `categoryId`, `locationId`, `priceMin`, `priceMax`, `sort`, `page` and `limit`. Schema-driven filters use `f.{attributeId}` for select option IDs, `b.{attributeId}` for booleans and `n.{attributeId}.min|max` for numeric/measurement bounds. Attribute filters require a category and are checked against PostgreSQL applicability/type rules before either search adapter runs.

The response contains authoritative public cards plus `total`, `page`, `limit`, `source` and `degraded`. Typesense returns only ordered listing IDs; PostgreSQL rehydrates and rechecks active visibility. Public responses have a short shared-cache policy.

## Favorites and saved searches

`GET /api/v1/favorites?locale=az|ru|en` returns the current actor's active favorite listing cards. `GET|PUT|DELETE /api/v1/favorites/{listingId}` reads, idempotently adds, or idempotently removes one relationship. The client never supplies a user ID; every operation derives ownership from the authenticated session.

`GET|POST /api/v1/saved-searches` lists or creates owner-only saved searches. Creation accepts a localized name and the same bounded query string used by public search, then reparses and normalizes it server-side. `PATCH|DELETE /api/v1/saved-searches/{savedSearchId}` can rename or delete only the current owner's resource; a cross-owner identifier returns `NOT_FOUND`. All engagement responses are private and `no-store`.

## Identity, profile and seller contact

Better Auth owns `/api/auth/*`, credential hashing, database sessions, HttpOnly cookies, origin checks and sign-out. Email/password sign-up and sign-in provide a working account path while phone OTP remains fail-closed until a production SMS adapter is verified. Email recovery and verification are not advertised as ready without an email provider.

`GET|PATCH /api/v1/profile` returns a minimal owner DTO and updates only the display name. Email and phone verification state are read-only through this resource; changing either identifier requires a separate verified flow.

`GET /api/v1/profile/listings?locale=az|ru|en` returns the current seller's own listings across lifecycle states, including the safe rejection explanation when present. It does not make pending or rejected content public.

`POST /api/v1/listings/{listingId}/contact` requires a database-backed session, an active listing, a different buyer and a verified seller phone. It returns only the phone protocol/number needed for a `tel:` action, records or increments an access audit, and limits an actor to 30 distinct contacts per rolling hour. Responses are private and `no-store`.

## Moderation contracts

`GET /api/v1/moderation/cases?locale=az|ru|en&limit=30` returns a minimal localized queue DTO only to users with a live staff role. It excludes seller email, phone, internal risk evidence and credentials. `POST /api/v1/moderation/cases/{caseId}/decision` accepts a validated approve/reject union. Rejection requires a bounded public explanation; authorization, self-review and current case/listing state are rechecked inside the transaction.

`GET /api/v1/listings/{listingId}/review` is seller-owner only and returns the current review state plus the safe rejection explanation. Cross-owner identifiers return `NOT_FOUND`. All moderation and owner-review responses are private and `no-store`.
