# ADR-0004: Relational taxonomy, typed EAV attributes, and imported geography

Status: accepted

## Context

Marketplace categories need localized, category-specific forms and future search facets without hardcoding frontend screens. Azerbaijan geography needs multiple place kinds and aliases without pretending an unverified hand-written list is official. A single free-form JSON listing document would weaken validation, filtering, migrations and data ownership.

## Decision

Use a maximum three-level adjacency-list category tree with localized translation rows. Define reusable typed attributes and normalized select options, then attach them to categories through an applicability table containing required/filter/search/sort/order behavior.

Store draft scalar values in a typed EAV table with mutually exclusive columns and multi-select values in a normalized join table. Keep validation constraints in explicit definition columns. JSON is permitted only as a derived API/search projection.

Use an adjacency-list location table with typed kinds, localized names, normalized aliases, stable source identity and verification metadata. Validate imported datasets with a versioned Zod contract. Ship only a small unverified dev sample until an authoritative production dataset is sourced and reviewed.

## Consequences

- schema-driven forms and search mappings can be produced from PostgreSQL in AZ/RU/EN;
- database constraints preserve value shape and option ownership while application services enforce applicability and lifecycle rules transactionally;
- changing category requires recalculation and optimistic draft versioning;
- joins are more involved than a JSON column, but constraints, localization, indexing and migrations remain inspectable;
- production geography completeness is an explicit verified-data prerequisite, not a claim made by the seed.
