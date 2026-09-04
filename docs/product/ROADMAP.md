# Delivery roadmap

## Phase 0 — discovery

Complete: master requirements reviewed, repository confirmed empty, initial architecture/cost research completed, assumptions and risks recorded.

## Phase 1 — architecture and planning

Complete.

- product, architecture, data, API, search, security, moderation, UX and deployment documents;
- ADRs for topology, persistence/search and external adapters;
- stable engineering instructions in `AGENTS.md`.

Exit: module boundaries, security boundaries, deployment shape and MVP sequence are explicit.

## Phase 2 — foundation

Complete. The SQL migration and seed are exercised in CI against PostgreSQL; production provider credentials remain an explicit deployment prerequisite.

- Next.js/TypeScript scaffold, formatting, linting and environment validation;
- design tokens and AZ/RU/EN i18n;
- PostgreSQL connection, migrations and deterministic seed;
- auth skeleton and provider interfaces;
- error model, structured logging, health checks, unit-test infrastructure and PostgreSQL-enabled CI. Journey E2E coverage is added with the core journeys it protects.

Exit: lint, typecheck, tests and production build pass.

## Phase 3 — marketplace core

In progress. Milestone 3A implements locations/import contract, three-level localized taxonomy, typed dynamic attributes and owner-controlled listing draft foundations. Milestone 3B adds the schema-driven creation UI, atomic publication snapshot, public listing lifecycle/read APIs, localized homepage feed and public listing detail page.

Media foundation is implemented: owner-only authorization, bounded quarantine ingress, signature/size/checksum verification, draft ordering/cover state, publication attachment snapshot, localized creation UI, decode/re-encode worker, dimension/animation checks, metadata-free variants and active-listing-only delivery. Production still requires worker scheduling/isolation, retention cleanup, malicious corpus testing and a live R2 verification.

Search/filter foundation is implemented: localized URL-state UI and API, category/location/price/dynamic facets, Typesense adapter, leased outbox indexing, atomic alias rebuild and indexed PostgreSQL fallback. Production still requires a live Typesense deployment/rebuild drill, load/ranking tuning and operational alerts.

Favorites and saved searches are implemented with owner-only APIs, active-listing visibility, reusable localized URL queries and a localized saved-items page.

Identity/contact foundation is implemented with Better Auth email credentials and database sessions, a localized account UI, minimal profile DTOs and audited verified-phone disclosure. Production phone OTP and email recovery still require verified providers.

Remaining Phase 3 sequence: moderation boundaries.

## Phase 4 — trust and communication

Chat, notification center, ratings, reports, moderation queues, risk signals, bans and audit.

## Phase 5 — shops

Shop ownership, permissions, verification state, storefront and shop listing management.

## Phase 6 — monetization

Promotions, promo codes, payment adapter, selected production provider, verified webhooks and receipts/notifications. No wallet.

## Phase 7 — launch hardening

Security/permission/performance/accessibility/SEO audits, responsive and E2E review, backups and restore drill, monitoring, rate-limit/abuse tests and deployment checklist.
