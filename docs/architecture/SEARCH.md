# Search

## Decision

Typesense is the initial dedicated search engine because it provides typo tolerance, ranking, faceting and fast autocomplete with modest operational complexity. It is a derived index behind a Satal-owned `SearchGateway`; PostgreSQL remains authoritative.

## Indexed document

Each active listing document contains stable listing/category/location IDs, normalized AZ/RU/EN search aliases, user title/description, price, freshness, seller type, selected typed facets, coarse location and promotion signals. Private data and internal risk scores are never indexed into a public collection.

## Query pipeline

1. Normalize whitespace, case and locale-specific characters without destroying brands/model identifiers.
2. Search weighted fields with typo tolerance and category/location constraints.
3. Apply schema-driven facets and deterministic sort options.
4. Return IDs and highlights; hydrate authoritative public projections from a read model/PostgreSQL.

Synonyms and multilingual aliases are curated data with admin/version history. Autocomplete combines categories, subcategories and safe popular queries. Empty/low-result telemetry guides improvements without retaining unnecessary anonymous history.

## Consistency and recovery

Listing transactions write an outbox entry. The worker upserts/deletes search documents idempotently. Failed jobs retry with bounded backoff and dead-letter visibility. A versioned reindex command rebuilds a new collection from PostgreSQL and atomically switches an alias.

## Migration path

The gateway owns search request/result contracts so Typesense can be replaced. PostgreSQL full-text/trigram search may provide a degraded fallback for maintenance, but production search is not based on `LIKE`.
