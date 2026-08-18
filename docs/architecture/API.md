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
