# ADR 0006: Owner engagement and saved-search snapshots

Status: accepted

## Context

Favorites and saved searches are private account state. Saved searches must preserve schema-driven filters without duplicating the entire evolving taxonomy in fixed columns or accepting an uncontrolled JSON document.

## Decision

Persist favorites as a normalized owner/listing relation with a composite primary key. Persist saved-search identity, ownership, locale, text, category, location, price bounds and sort as typed columns. Persist only the validated dynamic filter discriminated union as JSONB.

The application derives the owner from the server session, normalizes creation through the public search parser, checks referenced enabled catalog/geography rows and caps each owner at 50 saved searches. Cross-owner mutations return not found. Favorite creation requires an active listing, and reads rehydrate active PostgreSQL listings so removed content cannot leak through stale relationships.

## Consequences

PostgreSQL remains authoritative and common saved-search fields remain indexable. Taxonomy-defined filter evolution does not require a table per attribute. A future notification worker can evaluate the same normalized snapshot, but delivery cadence and alerts are outside this milestone. JSON migration may be required if the bounded filter union changes incompatibly.
