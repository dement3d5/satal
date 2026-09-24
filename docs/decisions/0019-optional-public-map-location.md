# ADR 0019: Optional public map location

Status: accepted

## Context

Buyers benefit from a real map, but requiring or publishing a private seller's exact address would create avoidable safety and privacy risk. The application also needs to remain independent from a single commercial map or geocoding provider.

## Decision

Store an optional public latitude/longitude pair and bounded landmark label on both `listing_draft` and the immutable `listing` snapshot. Coordinates are an all-or-nothing pair with database and API range validation. The seller must explicitly enable the public map and place the marker manually; exact address, apartment, entrance and door-code fields are not required.

Render maps through a small client-side Leaflet boundary. Development uses standard OpenStreetMap tiles with visible attribution and an environment-overridable tile URL. Public Nominatim autocomplete/geocoding is not used because its shared-service policy and personal-data implications do not fit this flow. Production must choose and verify a suitable tile provider; future geocoding belongs behind a separately reviewed server adapter.

## Consequences

PostgreSQL remains authoritative, publication copies a stable location snapshot, moderation can inspect the same public point before approval, and listings without a point show an honest unavailable state rather than a fake map. A deliberately approximate marker is supported. The application must keep attribution visible, avoid bulk tile access and document provider configuration before launch.
