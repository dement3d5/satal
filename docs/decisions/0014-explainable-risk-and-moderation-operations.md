# ADR 0014: Explainable listing risk and moderation operations

- Status: accepted
- Date: 2026-09-11

## Context

Every submitted listing currently waits for a human decision, but cases have no consistent prioritization or reason summary. Owners and administrators also lack a compact view of open workload and recent moderation activity. An opaque score, automatic enforcement or analytics-only source of truth would weaken review quality and auditability.

Risk processing must not duplicate matched phone numbers, email addresses, URLs or other private content into a secondary evidence store. Ordinary moderators need enough explanation to order work, while broad cross-queue operational visibility should follow least privilege.

## Decision

Submission evaluates a deterministic versioned policy inside the existing PostgreSQL publication transaction. The policy returns a bounded score, risk band and normalized reason codes/weights. The case stores the score as priority and keeps its policy version; `moderation_case_signal` stores one bounded signal per case and no matched text. The initial policy uses account tenure and structural contact-pattern presence. The assessment prioritizes review only: every submission remains `pending_review` until an independent staff decision.

Appeal acceptance preserves the original assessment and raises operational priority. A future policy change creates a new version; existing cases keep the version and signal rows that informed their ordering.

A private operations read model is calculated directly from PostgreSQL. Live `admin` and `owner` grants can request current queue counts, 7- or 30-day decision aggregates and a bounded recent-action projection. The projection combines existing append-only action tables and returns only actor display name, action, target identity and timestamp. Moderators retain queue and decision capabilities but cannot read the cross-queue operations projection.

## Consequences

- Queue ordering is explainable and reproducible without a JSON evidence blob.
- Matched contact values are not copied or returned; public and seller-facing contracts remain free of internal signals.
- Risk cannot approve, reject, remove, close, hide or ban anything automatically.
- PostgreSQL remains the source of truth for cases, signals, metrics and audit actions.
- Exact policy quality, monitoring, false-positive analysis and any future auto-approval require separate policy review and abuse testing.
- Account-wide enforcement, staff assignment and unrestricted evidence access remain separate future decisions.
