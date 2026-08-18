# ADR-0001: Modular monolith with web and worker modes

Status: accepted

## Decision

Use one TypeScript codebase and deployable image with clear domain modules. Run it as an HTTP/web process and a separate background worker process.

## Why

One owner gets simple deployment, shared types and transactions without premature distributed systems. Separating worker execution protects request latency and leaves an extraction path for genuinely independent modules.

## Consequences

Module boundaries need discipline and tests. Independent scaling is limited to web/worker modes initially. Cross-module writes must use application services/outbox rather than arbitrary table access.
