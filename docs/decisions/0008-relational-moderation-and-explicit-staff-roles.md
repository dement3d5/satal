# ADR 0008: Relational moderation and explicit staff roles

Status: accepted

## Context

New listings must not become public through a UI-only or hardcoded admin check. A solo owner needs a small usable queue today, while future explainable risk automation must remain possible without making an opaque score authoritative. Seeding a privileged identity or exposing public role assignment would create a critical escalation path.

## Decision

Submission creates an immutable listing snapshot in `pending_review` plus one relational moderation case. Store staff grants separately from Better Auth credentials and verify a live grant inside each application service. Decisions lock the case, prohibit self-review, require a reason, append an action, update listing history and emit an outbox event in one PostgreSQL transaction. Rejection requires a seller-safe explanation; internal notes never enter public or seller DTOs.

Use explicit `unassessed|low|medium|high` bands and a policy version rather than a universal numeric risk score. Begin with manual review for every listing. Future versioned rules may auto-approve low-risk cases through the same decision/audit boundary.

## Consequences

Public feeds and search remain limited to approved `active` rows, and staff access is testable independently of the UI. The initial owner role must be granted through a controlled operational procedure after the target account is verified. Assignment, evidence, appeals, reopening, automatic risk signals and staff-role management UI remain later milestones.
