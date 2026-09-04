# ADR 0007: Framework-owned identity and audited contact disclosure

Status: accepted

## Context

Satal needs usable accounts before a production SMS vendor is selected. Publicly embedding seller phone numbers would enable harvesting and bypass session, visibility and abuse controls. Fake OTP or recovery delivery would misrepresent readiness.

## Decision

Better Auth remains the only credential/session implementation. Enable its email/password path with a ten-character minimum and database-backed seven-day sessions. Keep the phone plugin and provider interface, but let disabled SMS fail closed. Do not claim email verification/reset until an email adapter is configured and verified.

Return profile data through a minimal owner-only DTO. Reveal a seller phone only through an authenticated versioned endpoint after checking that the listing is active, buyer differs from seller, and the phone is verified. Serialize requests per buyer, cap access to 30 distinct listings per rolling hour and upsert a relational audit without copying the phone number.

## Consequences

Local users can create accounts and exercise owner-only journeys without an external vendor. Production still requires provider onboarding, recovery testing and abuse tuning. Contacts are not present in public HTML or search indexes, and future moderation can use access metadata without retaining another copy of the phone. Chat remains a separate Phase 4 aggregate.
