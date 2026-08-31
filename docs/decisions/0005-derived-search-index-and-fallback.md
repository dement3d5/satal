# ADR-0005: Derived search index with authoritative hydration

## Status

Accepted.

## Context

Satal needs multilingual typo-tolerant faceting, but listing visibility, category applicability and lifecycle must remain transactionally controlled by PostgreSQL. Search downtime must not make the marketplace entirely unreadable or tempt application code to treat a vendor index as authoritative.

## Decision

Keep Typesense behind `SearchGateway` as a rebuildable ID-ordering index. Build localized denormalized documents only from active PostgreSQL snapshots. Feed incremental updates from leased transactional outbox events and rebuild into a versioned collection before atomically switching a stable alias. Hydrate every result ID from PostgreSQL and discard non-active or missing rows.

Use a partial PostgreSQL GIN full-text index plus relational typed facets as the explicit degraded adapter. Validate all dynamic filters against the selected category schema before either adapter executes. Keep filter state in shareable URLs.

## Consequences

- Typesense loss reduces typo tolerance/ranking quality but not basic marketplace discovery.
- Outbox lag and stale documents cannot make a non-public listing visible.
- Reindexing is online and rollback-friendly, at the cost of temporary duplicate collection storage.
- Operators must monitor outbox age/errors, deploy Typesense credentials and perform a live rebuild drill before production launch.
