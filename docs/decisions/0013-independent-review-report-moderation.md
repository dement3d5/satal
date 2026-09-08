# ADR 0013: Independent review-report moderation

## Status

Accepted.

## Context

Public reputation needs a way to address spam, harassment, exposed personal data and content unrelated to a qualified interaction. Direct deletion would erase evidence, editing an immutable review would weaken the reputation contract, and treating one report as an account-wide sanction would exceed the evidence and the current moderation scope. A staff member may also be the review author, subject or reporter, so possession of a staff role alone is insufficient for an impartial decision.

## Decision

Store reports and their decisions relationally in `review_report` and `review_report_action`. A report targets one public active `user_review`, is unique per reporter/review and is created under a per-actor lock with a rolling ten-per-hour limit. Fixed reason codes remain separate from optional bounded context.

Require a live `review-reports:read` or `review-reports:decide` capability at the application boundary. Omit reporter identity from the queue and exclude every staff member who authored, received or reported the same review. Recheck this relationship inside the locking decision transaction.

Dismissal resolves one report and appends one action. Confirming a violation changes the review from `active` to `hidden`, resolves every open report for it, appends one action per report and emits `reputation.review_hidden` in the same transaction. Public lists and rating aggregates use the same active-review predicate, so PostgreSQL remains the immediate visibility authority. The action does not ban or restrict either account.

## Consequences

Retries are safe, conflicting decisions serialize on the review, and every outcome has an immutable actor-attributed record. Reporter identity is not needed in browser queue data, and staff conflicts are enforceable in both reads and writes. A later account-enforcement model may consume repeated reviewed violations, but it requires its own evidence, appeal, expiry and audit policy instead of being inferred here.
