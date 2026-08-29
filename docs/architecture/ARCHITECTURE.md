# Architecture

## Style

Satal starts as a modular monolith in one TypeScript codebase and one deployable image. The image runs in two modes: HTTP/web and background worker. This keeps deployment simple while separating interactive latency from asynchronous work.

Next.js App Router renders public SEO pages and application UI. Versioned route handlers form the external API boundary. Both call application services; domain rules do not live in pages, server actions or database queries.

## Module boundaries

- **identity**: accounts, sessions, phone/email verification, recovery, roles and capabilities;
- **users**: private account data, public profile and preferences;
- **shops**: ownership, staff-ready permissions, verification and storefront;
- **locations**: Azerbaijan hierarchy, aliases and privacy-aware coordinates;
- **catalog**: categories, translations, attribute definitions/options and validation;
- **listings**: drafts, content, attributes, price, contacts and lifecycle;
- **media**: upload authorization, inspection, processing, variants and ownership;
- **search**: query contracts, indexing, facets, suggestions and saved searches;
- **favorites/recommendations**: explicit saves and explainable scoring;
- **chat**: listing-scoped conversations, messages, read state and blocks;
- **notifications**: preferences, in-app records and provider delivery;
- **moderation/risk**: reports, configurable signals, queues, actions and appeals;
- **promotions/payments**: promotion entitlements, provider-neutral attempts and webhooks;
- **analytics/admin/audit**: privacy-conscious events and owner operations.

Modules communicate through typed application interfaces and explicit events written to a transactional outbox. Direct cross-module table manipulation is forbidden outside documented read models.

## Request and event flow

1. UI or API validates input and establishes actor/context.
2. An application service checks capability and invariant.
3. A transaction updates PostgreSQL and, when needed, writes an outbox job.
4. The worker processes media, indexing, notifications or analytics idempotently.
5. Realtime delivery notifies connected clients; persisted state remains authoritative.

## Background work

Use a PostgreSQL job/outbox table with leases, retry policy and `FOR UPDATE SKIP LOCKED`. This is sufficient for early volume and avoids Redis/queue operations. Introduce a dedicated queue only after measured contention or throughput demands it.

## Realtime

A WebSocket/Socket.IO gateway lives beside the web process initially. Messages are persisted before delivery. A single instance needs no broker; multi-instance coordination can later add PostgreSQL notifications or Redis after measurement.

## Dependency direction

`presentation/API → application → domain`; infrastructure implements ports owned by application/domain. Vendor SDKs never leak into domain types.

## Phase 3 schema boundaries

`geography` owns the import contract, hierarchy validation and localized canonical place records. The committed sample is not an authoritative Azerbaijan register; production import requires a verified source and review.

`catalog` owns the three-level category tree, localized labels, typed attribute definitions/options and category applicability. Frontend code renders the schema returned by an application query; it must not contain category-specific forms or lists.

`listings` owns draft authorization, lifecycle and category-change recalculation. A category change is one PostgreSQL transaction: lock/version-check the draft, authorize the owner, load the next schema, retain only compatible values, remove invalid values, update the captured schema version and increment the autosave version. Route handlers remain thin and will be added with the draft API/UI milestone.

Media, Typesense, chat, shops and payments are not implemented in this milestone. Published-listing and search projections remain later boundaries driven from PostgreSQL/outbox state.
