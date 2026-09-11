# Security and privacy baseline

## Identity

Better Auth is the initial session/auth framework with a phone-number plugin and provider adapter. Production SMS credentials/onboarding remain required. Store normalized E.164 phone data encrypted or access-restricted where practical; never expose it by default. Admin/owner require 2FA and stronger session controls.

Sessions use secure HttpOnly cookies, rotation and revocation. Browser sign-out is delegated to the official Better Auth client, deletes the database session, expires the session cookie and verifies loss of private API access before redirecting; account switching therefore cannot reuse stale client-rendered identity state. Passwords use a modern memory-hard hash through the auth framework. OTP requests and attempts receive per-number, per-session and network risk limits without relying on IP alone. A complete user-facing active-session/device management screen remains a later security milestone.

Email/password is enabled as a functional account path through Better Auth; passwords never enter Satal tables or logs outside the framework's credential record. Phone OTP remains the preferred production path but fails closed while SMS is disabled. Email verification/reset and phone verification require real provider adapters and remain explicit launch prerequisites.

## Authorization

Use capability-based RBAC for user, shop owner, moderator, support, admin and owner. Application services authorize both action and target ownership. Add integration tests for IDOR and privilege boundaries.

Favorites and saved searches never accept an owner ID from the client. The actor comes from the validated session, cross-owner saved-search mutations return `NOT_FOUND`, and private responses use `no-store`. Favorite reads re-check active listing visibility so a stale relationship cannot expose removed content. Integration coverage exercises these ownership boundaries.

Listing reports and appeals also derive the actor exclusively from the session. Reports require an active listing owned by another user, are unique per reporter/listing and are limited to ten new targets per rolling hour under a serialized actor lock. Appeals require the listing seller and return `NOT_FOUND` across the ownership boundary. Staff report/appeal decisions verify a live role and prohibit acting on the reviewer's own listing inside the locking transaction.

Listing risk assessment runs inside the submission transaction and stores bounded reason codes/weights only. Matched phone numbers, email addresses and URLs are not copied into signal rows or logs, signals never make an automatic enforcement decision, and only the live staff queue exposes the summaries. Cross-queue counts and recent action projections require `admin` or `owner` and omit internal notes, reporter identities, content and private account attributes.

Conversation APIs derive the actor from the session and resolve the other participant only from the PostgreSQL conversation. Starting a thread derives its seller from the active listing, rejects self-contact and creates at most one conversation per listing/buyer. Every read, send, read-cursor update and block operation rechecks participant membership; cross-participant IDs return `NOT_FOUND`. Either-direction blocks stop new messages but do not erase evidence/history. Actor-row serialization and a rolling per-sender bound reduce basic flooding, while client-generated UUIDs make retries idempotent.

Message reports verify the conversation/message relationship and allow only the recipient to report an immutable message. The server derives the reporter, serializes actor writes, enforces one report per reporter/message plus a rolling limit, and returns `NOT_FOUND` outside the participant boundary. Staff queue DTOs omit reporter identity and unrelated chat history. Staff who participated in the conversation cannot read its report through the queue or decide it. A confirmed report closes only that conversation and produces append-only actions; account bans require the separate enforcement model.

Reputation writes are limited to a seller-confirmed interaction tied to the exact listing conversation. Qualification requires the recorded seller, an active listing, an open conversation and bidirectional messages; it atomically marks the listing sold so one listing cannot manufacture multiple qualified buyers. Review author and subject IDs are never accepted from clients. Each participant receives one immutable review slot, and the public visibility/aggregate predicate keeps the first review blind until a counterpart review or 14-day deadline reduces retaliation pressure. Review reporting and staff hiding remain a separate trust milestone; the schema has an explicit hidden lifecycle but no public mutation endpoint.

Notifications are recipient-owned server projections; clients cannot choose a recipient, actor, listing or message reference. A notification read update includes the current recipient in its predicate. External email/push preferences cannot be enabled until a verified provider exists, preventing a disabled adapter from simulating delivery.

## Review-report isolation

Review reports accept only public active review IDs, reject author self-reporting, use an idempotent reporter/review relationship and enforce a serialized rolling rate limit. Staff DTOs omit reporter identity. A staff member who authored, received or reported the review is excluded from both queue and decision paths. A confirmed decision hides only the review, is append-only audited and does not create an account sanction.

## Web/API controls

Validate server-side, escape output, apply CSP/security headers, CSRF defenses where cookies authorize mutations, strict CORS/trusted origins, request size/time limits and SSRF-safe outbound clients. Return safe errors with correlation IDs.

## Media

Uploads use short-lived server-authorized object keys. Quarantine until signature, size and dimensions are checked and images are safely decoded/re-encoded with metadata removed. Serve variants from a separate media origin. No video, voice, executables or arbitrary files in MVP.

The implemented ingress requires draft ownership, an exact declared size and SHA-256 digest, a ten-minute HMAC capability, a bounded uncompressed request body and JPEG/PNG/WebP magic-byte agreement. Client filenames never become object keys. Local development writes only below ignored `.data/media`; the production R2 adapter fails closed until credentials and a live end-to-end check exist. Quarantine objects are never served. The Sharp/libvips worker performs bounded real decoding, rejects animation and unsupported formats/dimensions, applies orientation and re-encodes metadata-free WebP variants. Public reads additionally require a `ready` asset attached to an active listing. Decoder updates, worker isolation/resource limits, cleanup monitoring and malicious corpus tests remain launch gates.

## Privacy

Collect minimum data. Never publish email, IP, device identifiers, exact private address, internal risk state or private account data. Define retention/export/deletion before launch. Azerbaijan privacy/e-commerce obligations require qualified legal review before production.

Chat text and notification metadata are private personal data. They are excluded from public pages, search indexes and logs. Staff access is limited to the concrete content of open message reports and is protected by a live capability plus self-review exclusion. Production still requires legally reviewed retention/export/deletion periods, access monitoring and an incident process before launch.

An authenticated buyer may request the verified phone of a different seller only for an active listing. The exact number is returned in a private non-cacheable response, never embedded in public HTML, search, logs or the contact audit. Per-buyer access is recorded and bounded to reduce harvesting; data retention and seller visibility controls require launch review.

## Operations

Secrets live in environment/secret management; `.env` is ignored. Logs are structured and redact secrets/PII. Sensitive admin, role, moderation, ban and payment events are immutable/auditable. Backups are encrypted and restore-tested.

## Launch gates

Threat model, dependency and permission audit, abuse/rate-limit tests, backup restore, upload security tests, admin 2FA, headers/CSP, incident contacts and prohibited-items/legal policies.
