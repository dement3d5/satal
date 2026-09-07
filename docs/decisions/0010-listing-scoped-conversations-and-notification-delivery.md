# ADR 0010: Listing-scoped conversations and durable notification delivery

- Status: accepted
- Date: 2026-09-07

## Context

Phase 4 needs buyer/seller communication without creating an unbounded social inbox, trusting client-supplied participants or making a realtime connection authoritative. Retries, concurrent sends, listing lifecycle changes and user blocks must have deterministic behavior. In-app notifications must work now, while email and push providers are not selected or verified.

## Decision

Use one PostgreSQL `conversation` per `(listing, buyer)`. The seller is constrained to the listing seller, participants are immutable and messages receive a transactionally assigned per-conversation integer sequence. Each sender supplies a UUID `client_message_id`; `(conversation, sender, client_message_id)` is unique. Buyer and seller read cursors live on the locked conversation aggregate, making pagination and unread counts independent of timestamp precision.

Only an active listing can start a conversation. Existing conversations remain readable, and active or sold listings accept follow-up messages. A directed `user_block` relationship in either direction prevents new messages without deleting history. Actor and conversation locks serialize rate checks and sequence assignment. An idempotent retry returns an already-persisted message even if a later block or lifecycle change would reject a new send.

Persist a recipient-owned `notification` projection and one `notification_delivery` row per enabled channel in the same message transaction. In-app delivery is immediately durable. Email/push use provider-neutral pending rows and a typed provider port, but public preferences fail closed when those providers are unavailable. A transactional `chat.message_sent` outbox event is the later realtime handoff; polling/private HTTP reads are the current transport.

## Consequences

PostgreSQL remains authoritative for conversation history, unread state, blocks and delivery intent. Participant authorization is simple and testable, duplicate sends are prevented, and realtime/provider outages cannot lose committed messages. The model intentionally does not support unrelated direct messages, group chat, message editing or deletion. Message-scoped reports and narrow staff evidence access are added by ADR 0011; external delivery workers and production realtime remain separate privacy- and operations-reviewed milestones.
