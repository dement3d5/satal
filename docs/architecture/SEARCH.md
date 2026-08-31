# Search

## Decision

Typesense is the initial dedicated search engine because it provides typo tolerance, ranking, faceting and fast autocomplete with modest operational complexity. It is a derived index behind a Satal-owned `SearchGateway`; PostgreSQL remains authoritative.

## Indexed document

Each active listing document contains stable listing/category/location IDs, AZ/RU/EN searchable text, user title/description, price, freshness, selected typed facets and coarse location ancestry. Private data and internal risk scores are never indexed into a public collection. Seller-type and promotion ranking signals remain future versioned schema additions.

## Query pipeline

1. Normalize whitespace, case and locale-specific characters without destroying brands/model identifiers.
2. Search weighted fields with typo tolerance and category/location constraints.
3. Apply schema-driven facets and deterministic sort options.
4. Return IDs and highlights; hydrate authoritative public projections from a read model/PostgreSQL.

Synonyms and multilingual aliases are curated data with admin/version history. Autocomplete combines categories, subcategories and safe popular queries. Empty/low-result telemetry guides improvements without retaining unnecessary anonymous history.

## Consistency and recovery

Listing transactions write an outbox entry. The worker upserts/deletes search documents idempotently. Failed jobs retry with bounded backoff and expose attempts plus a safe last-error field for operations. A versioned reindex command rebuilds a new collection from PostgreSQL and atomically switches an alias.

The search milestone implements this pipeline. `listing.published` outbox events are claimed with an expiring lease, retried with bounded exponential backoff and projected only from active PostgreSQL rows. `pnpm search:process` drains pending events; `pnpm search:reindex` builds a timestamped collection, verifies every JSONL import result and switches the stable `satal_listings` alias only after a complete import. Old collections are retained for operator-controlled rollback/cleanup.

The public query contract is `/api/v1/search` and `/{locale}/search`. Query, category, location, price, sort, page and schema-driven attribute filters remain in the URL. Dynamic filters are accepted only when the selected category marks the attribute filterable and submitted option IDs belong to that attribute. Search returns IDs; public cards are rehydrated from PostgreSQL, so stale index documents cannot expose removed listings.

## Migration path

The gateway owns search request/result contracts so Typesense can be replaced. If Typesense times out or is unavailable, PostgreSQL uses a partial GIN `to_tsvector('simple', title || description)` index plus relational category/location/typed-attribute filters. The response exposes `degraded: true`; production search is never based on `LIKE`.
