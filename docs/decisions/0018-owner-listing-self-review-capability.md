# ADR 0018: Platform owner listing self-review capability

Status: accepted

## Context

The launch configuration can have one platform operator who is also a marketplace seller. A blanket self-review exclusion leaves that operator unable to publish any listing without provisioning an artificial second staff account. Hardcoding an email address or weakening every staff role would make authorization opaque and unsafe.

## Decision

Add the explicit `listings:self-review` moderation capability only to the platform `owner` role. An owner may see its own pending listing in the listing queue, inspect its processed moderation media, claim the case and approve or reject it. Moderator and admin roles remain unable to review their own listings. The exception applies only to initial listing moderation; report, appeal, message-report and review-report independence rules do not change.

Owner self-review follows the same server-side transaction and audit path as every other listing decision. The owner must claim the case first, the UI still requires deliberate confirmation, the current lifecycle is locked and rechecked, and the decision, status history and outbox event remain append-only and attributable to the owner account.

## Consequences

A solo platform owner can operate the initial marketplace without a second privileged identity, and the capability remains testable and revocable through the existing PostgreSQL role grant. This is a declared conflict-of-interest tradeoff for early operations. Production governance should add independent reviewers and remove routine owner self-review when staffing permits. No user email or account identifier is embedded in application code.
