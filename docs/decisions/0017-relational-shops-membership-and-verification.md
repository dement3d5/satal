# ADR 0017: relational shops, scoped membership and independent verification

## Status

Accepted.

## Context

Satal needs business storefronts without turning a shop into a special user account or allowing a client-selected identity to own listings. One person may work for a shop, future shops need several employees, and a public verification badge must not silently grant moderation privileges or bypass listing review. Shop profile, hours, membership and verification state also need to remain queryable and auditable in PostgreSQL rather than becoming one mutable JSON document.

## Decision

A shop is a separate aggregate owned by a normal user. `shop` stores stable public identity and lifecycle fields; `shop_member` stores explicit `owner`, `manager` and `listing_manager` roles. Capability checks are centralized in the shops domain and rerun inside every protected transaction. The owner membership is created atomically with the shop, only the owner changes membership, and an account owns at most one shop in the MVP while it may participate in several.

Business hours use one normalized row per weekday with bounded opening/closing minutes. Logo and cover use a typed `shop_media` attachment and the existing quarantined media pipeline. Public address/phone are optional business fields; no private seller address is inferred or copied.

Drafts and listings carry an optional shop reference plus the existing concrete author/seller. Draft creation and publication require a live shop listing capability and active shop. Publication copies the association but follows the same moderation lifecycle as a personal listing.

Verification applications are immutable-history records with a single pending-request constraint. Submission requires a complete public business profile. Only platform `admin`/`owner` roles decide; the decision changes the verification badge only and does not change listing visibility, search rank or staff permissions. Changing verified identity fields removes the badge, and changing them while review is pending cancels that request. Resolved requests and reviewer notes remain private audit data.

## Consequences

- permissions remain least-privilege and are independent from platform staff roles;
- PostgreSQL can rebuild storefronts, permissions, verification and later search projections;
- listing authorship remains attributable after a member leaves a shop;
- the one-owned-shop limit simplifies the MVP but requires a reviewed ownership-transfer/multi-shop migration before expansion;
- accepting members by existing account email is an MVP operation; invitation acceptance, transfer, suspension appeals and verified document storage remain required follow-up work.
