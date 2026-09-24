# ADR 0020: Owner visibility into conflict-linked queues

Status: accepted

## Context

A solo launch owner needs complete operational visibility. Independent staff filters previously made persisted complaints disappear from the owner's workspace whenever that account was also a seller, conversation participant, review party or reporter. Hardcoding the launch email would make the policy invisible and brittle.

## Decision

Add `conflicts:view` only to the platform `owner` role. Owner queue reads include all open listing, message and review reports and appeals. Moderator/admin reads retain independent-review filtering and receive only an aggregate hidden-conflict count so the UI can explain why visible and operational totals differ.

This capability changes visibility, not decision integrity. Existing server-side conflict rules still prevent an actor from resolving its own report, appeal, conversation or review dispute. Initial listing self-review remains the separate, audited `listings:self-review` exception from ADR 0018.

## Consequences

The owner account can verify that every complaint was persisted and route work without embedding an email address in code. Sensitive queue content remains hidden from conflicted moderator/admin accounts, and all decisions continue through lifecycle locks and append-only audit records. If production governance later requires a stricter owner separation, the capability can be removed from the role without changing stored data.
