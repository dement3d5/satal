# Deployment and operations

## MVP topology

- Cloudflare for DNS, TLS/WAF/CDN and R2 object storage;
- Railway project with the same container image running `web` and `worker` commands;
- managed Railway PostgreSQL with persistent volume/backups;
- a small Typesense service with persistent volume;
- external SMS/email providers behind adapters;
- an owner-verified first staff-role grant performed through controlled database operations; no privileged account is seeded;
- GitHub Actions for checks and controlled deployment.

This shape avoids Kubernetes and vendor-specific domain logic. All stateful components have export/rebuild paths.

## Cost envelope

Railway is usage-based with a $5 Hobby minimum and $20 Pro minimum; a continuously running web, PostgreSQL and small search/worker footprint is expected to land roughly in the low tens of USD monthly, but must be measured with budgets/alerts. Cloudflare R2 currently includes 10 GB-month and substantial request allowances, then charges low storage/operation rates with no direct egress fee. SMS, email and payment fees are separate and usage-dependent.

The production target is approximately $20–40/month before communication/payment volume. This is an estimate, not a quote. Re-evaluate prices, region latency, backup/SLA needs and commercial plan terms before launch.

## Environments

Local Docker dependencies, one shared staging environment with isolated data/keys, and production with separate secrets/buckets/databases. Never use production credentials locally or copy production personal data into staging.

Every release runs `pnpm install --frozen-lockfile`, `pnpm db:check`, lint, typecheck, tests and build. Apply `pnpm db:migrate` as a controlled release step before starting new application code; run `pnpm db:seed` for idempotent reference data. Rollback must account for whether a migration is backward-compatible.

The worker image can run `pnpm media:process` as a bounded one-shot media batch. Production scheduling must repeat it with overlap protection and backlog/error metrics. Before enabling uploads, replace the fail-closed R2 adapter with least-privilege quarantine/variant bucket access and verify upload, processing, active-listing delivery, rejected-input cleanup and object lifecycle policies end to end. Web processes must never serve quarantine keys.

Before opening public reporting, publish the reviewed marketplace policy and staff response procedure, monitor report/appeal age and volume, and define retention/export/deletion handling for free-text statements. Free-text must never be copied into logs or public listing/search projections. Staff roles remain owner-controlled and require stronger account protection before production.

Before opening chat publicly, define message retention/export/deletion and lawful staff-access procedures, add conversation/message reporting, tune rate/abuse limits under load and monitor message/outbox age. The current client refreshes private PostgreSQL state; production realtime requires a separately authenticated WebSocket/SSE gateway that consumes `chat.message_sent` without bypassing service authorization. Email and push delivery must stay disabled until a least-privilege provider adapter, verified sender/domain, bounce/failure handling and end-to-end delivery test exist.

Set `SEARCH_PROVIDER=typesense`, `TYPESENSE_URL` and a least-privilege `TYPESENSE_API_KEY` only after the service is reachable. Run `pnpm search:reindex` once to create and atomically attach the initial collection alias, then schedule `pnpm search:process` as a repeated bounded outbox drain. Alert on unprocessed event age, attempts and `last_error`. PostgreSQL remains usable in degraded mode, but this is not a substitute for monitoring and restoring Typesense.

## Reliability

Health/readiness checks, structured logs with correlation IDs, error tracking, basic latency/error/job/backlog metrics, cost counters and alerting. Database backups and object lifecycle rules require a documented restore drill before launch. Typesense is rebuildable from PostgreSQL.

## Scaling

First scale web/worker resources and database indexes; then add replicas. Introduce Redis/broker only when multi-instance realtime coordination or job contention is measured. Move search to managed Typesense when operator time or availability requirements justify the recurring cost.
