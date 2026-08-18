# Engineering instructions

This repository builds Satal, an Azerbaijan-first classifieds marketplace. Read the relevant documents under `docs/` before changing architecture or product behavior.

## Priorities

1. User convenience and the fewest useful actions.
2. Search quality and perceived speed.
3. Security, privacy, and mobile UX.
4. Accessibility, SEO, maintainability, and low operating cost.

## Architecture

- Keep a modular monolith. Do not introduce microservices, Kafka, Kubernetes, event sourcing, or Redis without a measured need.
- PostgreSQL is the business source of truth. Typesense, caches, and analytics are rebuildable derived views.
- Keep domain/application rules out of React components, route handlers, ORM models, and vendor adapters.
- Public and mobile-facing operations use versioned API contracts. UI server actions may orchestrate UX but must delegate business rules to application services.
- External systems sit behind narrow adapters. Never claim an integration is production-ready without live credentials and an end-to-end verification.

## Security and privacy

- Validate and authorize every mutation server-side. UI hiding is not authorization.
- Treat all uploads as hostile: inspect signatures, enforce limits, decode and re-encode images, and never trust client MIME or filenames.
- Never log or commit passwords, OTPs, tokens, session secrets, private addresses, payment data, or internal risk signals.
- Apply least privilege, endpoint-specific rate limits, secure sessions, audit logging, idempotency, and protection against IDOR, CSRF, XSS, SSRF, replay, brute force, and resource exhaustion.
- Preserve approximate location for private sellers; exact public coordinates require explicit business intent.

## UX

- AZ is the primary interface locale; RU and EN are mandatory. System text belongs in i18n resources; user content remains distinct.
- Design mobile and desktop intentionally. Preserve filter/search state in shareable URLs where safe.
- Provide loading, empty, error, expired, sold, removed, pending, rejected, and offline states where relevant.
- Prefer semantic HTML, keyboard access, visible focus, restrained motion, skeletons, and one calm visual accent.

## Quality gates

Before reporting a change complete, run the relevant subset and normally all of:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:check
```

Critical domain rules require unit tests; persistence and permissions require integration tests; core journeys require Playwright E2E tests. Test risks, not arbitrary coverage percentages.

## Change discipline

- Study existing patterns before adding abstractions or dependencies.
- Use migrations for schema changes; do not use destructive schema push in production.
- Keep migrations forward-applicable and seeds idempotent; never seed privileged production identities.
- Update docs and ADRs when architecture, security boundaries, or operational responsibilities change.
- Do not leave fake integrations, empty handlers, security-critical TODOs, or misleading readiness claims.
- Keep commits focused and reviewable. Never commit `.env` files or generated secrets.
