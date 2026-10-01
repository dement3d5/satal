# ADR 0018: unified professional profiles with vertical-safe listings

## Status

Accepted.

## Context

An automotive dealership behaves like a storefront, but real-estate supply is represented by independent realtors, agencies and property developers. Building separate membership, verification, media and listing-ownership systems for each profession would duplicate security-sensitive logic. Treating every professional as a generic shop would be misleading and would allow unrelated listing categories unless the server enforced a boundary.

## Decision

Retain the existing `shop` aggregate and stable API/routes as an internal compatibility boundary, while presenting it as a professional profile. Add a required `professional_profile_type`: `auto_dealer`, `realtor`, `real_estate_agency` or `property_developer`. The temporary `unspecified` value exists only so migrations never guess the identity of an existing profile; new profiles cannot choose it.

Autodealer profiles accept categories under the `transport` taxonomy root. Realtor, agency and developer profiles accept categories under `real-estate`. The application resolves the current taxonomy ancestry from PostgreSQL and enforces this rule during draft creation, category change, profile-type change and publication. Personal listings remain independent. Profile-type changes reset pending/approved verification like other public identity changes and are rejected if linked records would become incompatible.

Membership, business hours, media quarantine, verification history, listing authorship and public profile rendering continue to use the existing normalized tables. An independent realtor profile rejects non-owner members in the service layer and hides team management in the UI; organizations retain owner/manager/listing-manager capabilities. Only the profile owner may change its type, and a migrated `unspecified` profile cannot request verification until its owner selects one. The profile type does not grant platform moderation privileges and never bypasses listing review.

## Consequences

- users see profession-appropriate language without four duplicated backends;
- category boundaries cannot be bypassed by a crafted client or a later category change;
- existing data remains intact and intentionally unclassified until its owner selects a type;
- stable `/shops` API and routes avoid a disruptive migration while public copy can evolve;
- developer projects, employee invitation acceptance, ownership transfer and organization-level reputation remain explicit later milestones.
