# Satal

Satal is an Azerbaijan-first multilingual classifieds marketplace. The product optimizes for a short path from arrival to a relevant listing, category-aware search, trustworthy seller interactions, and low-complexity operation during MVP.

Phase 2 and the Phase 3 marketplace, media and search foundations are complete. The repository contains no production-ready SMS, email, storage, payment or hosting integration. Typesense has a real adapter but still requires owner-provided service credentials and deployment verification; disabled providers fail closed instead of simulating success.

## Foundation

- Next.js 16 App Router, React 19, strict TypeScript and pnpm;
- AZ-default localized routes with RU and EN resources via `next-intl`;
- PostgreSQL through Drizzle ORM, versioned SQL migrations and deterministic locale seed;
- Better Auth core schema and phone-number flow behind an SMS provider port;
- validated server environment, structured/redacted Pino logs and typed HTTP errors;
- Vitest, ESLint, Prettier and GitHub Actions quality gates;
- responsive design tokens, accessible focus/reduced-motion behavior and health endpoint.
- imported hierarchical geography, three-level localized taxonomy, typed category attributes and owner/version-controlled listing drafts.
- atomic draft publication into a PostgreSQL listing snapshot, lifecycle/outbox history, public API, localized homepage feed and public detail page.
- owner-authorized image uploads, hostile-file quarantine, Sharp/libvips re-encoding and metadata-free responsive variants for local development.
- localized URL-state search/filter UI, validated dynamic facets, a replaceable Typesense adapter/outbox indexer and indexed PostgreSQL degraded fallback.
- owner-only favorites and reusable saved searches with localized UI and normalized PostgreSQL query snapshots.
- Better Auth email/password sessions, localized account/profile UI and audited access to verified seller phone contacts.

## Requirements

- Node.js 24 or newer;
- pnpm 11.19.0 (declared in `packageManager`);
- PostgreSQL 17 for migration/seed work.

## Local setup

```powershell
Copy-Item .env.example .env.local
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The default local database URL is `postgresql://satal:satal@localhost:5432/satal`. Replace `AUTH_SECRET` in `.env.local` with a unique value of at least 32 characters. Never commit local environment files or real credentials.

The application is available at `http://localhost:3000/az`; `GET /api/v1/health` is the process health endpoint. OTP delivery intentionally returns a service-unavailable error while `SMS_PROVIDER=disabled`.

Uploaded local images remain under ignored `.data/media/quarantine` until a worker pass processes them. Run `pnpm media:process` in another terminal (or schedule repeated one-shot runs) to create safe local WebP variants. Production requires a separately configured worker and verified R2 adapter; quarantine files are never public.

Local search defaults to PostgreSQL. For Typesense, set `SEARCH_PROVIDER=typesense`, `TYPESENSE_URL` and `TYPESENSE_API_KEY`, then run `pnpm search:reindex`; schedule `pnpm search:process` to drain publication events. Never commit the API key.

## Database workflow

Edit `src/server/db/schema.ts`, then generate and validate a versioned migration before applying it:

```powershell
pnpm db:generate
pnpm db:check
pnpm db:migrate
pnpm db:seed
```

Do not use schema push in production. The seed is idempotent and creates only the supported AZ/RU/EN locale reference data; it never creates a privileged user.

## Quality gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI also starts PostgreSQL and verifies the migration and seed. A production build requires valid `APP_ORIGIN`, `DATABASE_URL`, and `AUTH_SECRET` environment values but does not connect to PostgreSQL during compilation.

## Architecture and product documentation

- [Product definition](docs/product/PRODUCT.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Data model](docs/architecture/DATA_MODEL.md)
- [API](docs/architecture/API.md)
- [Search](docs/architecture/SEARCH.md)
- [Security](docs/security/SECURITY.md)
- [Moderation](docs/security/MODERATION.md)
- [UX](docs/ux/UX.md)
- [Deployment](docs/operations/DEPLOYMENT.md)
- [Roadmap](docs/product/ROADMAP.md)
- [Architecture decisions](docs/decisions/)

The codebase is a modular monolith. PostgreSQL is authoritative; Typesense and object storage remain replaceable adapters. Domain/application rules must not live in React components, route handlers, ORM models, or vendor SDKs.

## Deployment boundary

GitHub Actions currently validates the foundation only. Production deployment remains blocked on owner-controlled hosting, PostgreSQL, SMS and secret-management configuration. Follow `docs/operations/DEPLOYMENT.md`; do not infer readiness from local provider stubs.

## Troubleshooting

- If pnpm cannot reach the registry, allow outbound HTTPS access from the Codex environment to `registry.npmjs.org`, including `/-/npm/v1/attestations/`, and rerun `pnpm install --frozen-lockfile`.
- If migration or seed fails, confirm PostgreSQL is running and `DATABASE_URL` points to an accessible database.
- On Windows, run commands from PowerShell and confirm the Node/pnpm versions before diagnosing application code.
- Never resolve a temporary network or provider problem by silently replacing the stack recorded in the ADRs.
