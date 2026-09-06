# ADR 0009: Relational reports and appeals

Status: accepted

## Context

Phase 4 needs buyer reports and a meaningful seller appeal path without turning free-form messages into moderation state, silently publishing disputed content or creating a second privileged system beside the existing moderation case. Reports can be retried or abused, while appeals must preserve the exact decision being challenged.

## Decision

Model reports and appeals as separate relational aggregates with explicit lifecycle columns and append-only staff action tables. A report is unique for a reporter/listing pair, is accepted only for an active listing owned by another user and is subject to a serialized rolling-hour limit. Confirming one report removes the listing and resolves every open report for it in one transaction; each resolved report receives its own audit action.

Tie each appeal to one rejecting `moderation_action`, require the current listing seller and permit only one open appeal per listing. Rejecting an appeal requires a seller-safe public response. Accepting an appeal increments the listing version and reopens the existing case in `pending_review`; it never makes the listing public. Prior moderation and appeal actions stay immutable, and the next publication still requires the normal moderation decision.

PostgreSQL remains authoritative. Typesense consumes the resulting `listing.removed` event as a derived cleanup operation, while public reads continue to recheck active PostgreSQL visibility. Free-text details/statements stay out of public/search DTOs and logs.

## Consequences

Retries do not create duplicate reports or appeals, IDOR and self-review rules are testable in application services, and the complete decision history remains available for future audit tooling. The initial report limit is deliberately simple and database-backed; production policy, retention, metrics and more advanced abuse signals remain launch work. Reusing a moderation case keeps one aggregate identity per listing, so queue readers must use the current case state and retain all historical actions.
