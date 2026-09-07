# ADR 0012: Qualified interactions and blind bilateral reviews

## Status

Accepted.

## Context

Open reviews allow fake accounts to rate arbitrary users, while reviews shown immediately invite retaliatory scoring. Satal does not process the underlying purchase and therefore needs a narrow, explainable interaction signal without claiming payment certainty.

## Decision

A qualified interaction is created only by the recorded listing seller from an open conversation after both buyer and seller have persisted at least one message. The transaction locks the conversation and active listing, creates one interaction unique to both listing and conversation, changes the listing to `sold`, appends lifecycle history and emits `listing.sold` for derived-index removal.

Each recorded participant may submit one immutable 1–5 rating and optional bounded text about the other participant. The API derives both identities and never accepts either ID from the client. Reviews remain public-blind until an active counterpart review exists or 14 days pass. Public review lists and rating aggregates share this visibility rule. The explicit `hidden` state is reserved for a later audited review-moderation workflow and is not exposed as a public mutation.

## Consequences

Ratings are tied to stronger evidence than account possession, one listing creates at most one qualified buyer, and neither participant can inspect the other's first review before submitting. This does not prove that money or goods changed hands, so product language says “confirmed interaction” rather than “verified purchase.” Seller mistakes currently require an audited future support workflow instead of an unsafe self-service reversal.
