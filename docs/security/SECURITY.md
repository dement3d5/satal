# Security and privacy baseline

## Identity

Better Auth is the initial session/auth framework with a phone-number plugin and provider adapter. Production SMS credentials/onboarding remain required. Store normalized E.164 phone data encrypted or access-restricted where practical; never expose it by default. Admin/owner require 2FA and stronger session controls.

Sessions use secure HttpOnly cookies, rotation, revocation and active-session management. Passwords use a modern memory-hard hash through the auth framework. OTP requests and attempts receive per-number, per-session and network risk limits without relying on IP alone.

Email/password is enabled as a functional account path through Better Auth; passwords never enter Satal tables or logs outside the framework's credential record. Phone OTP remains the preferred production path but fails closed while SMS is disabled. Email verification/reset and phone verification require real provider adapters and remain explicit launch prerequisites.

## Authorization

Use capability-based RBAC for user, shop owner, moderator, support, admin and owner. Application services authorize both action and target ownership. Add integration tests for IDOR and privilege boundaries.

Favorites and saved searches never accept an owner ID from the client. The actor comes from the validated session, cross-owner saved-search mutations return `NOT_FOUND`, and private responses use `no-store`. Favorite reads re-check active listing visibility so a stale relationship cannot expose removed content. Integration coverage exercises these ownership boundaries.

## Web/API controls

Validate server-side, escape output, apply CSP/security headers, CSRF defenses where cookies authorize mutations, strict CORS/trusted origins, request size/time limits and SSRF-safe outbound clients. Return safe errors with correlation IDs.

## Media

Uploads use short-lived server-authorized object keys. Quarantine until signature, size and dimensions are checked and images are safely decoded/re-encoded with metadata removed. Serve variants from a separate media origin. No video, voice, executables or arbitrary files in MVP.

The implemented ingress requires draft ownership, an exact declared size and SHA-256 digest, a ten-minute HMAC capability, a bounded uncompressed request body and JPEG/PNG/WebP magic-byte agreement. Client filenames never become object keys. Local development writes only below ignored `.data/media`; the production R2 adapter fails closed until credentials and a live end-to-end check exist. Quarantine objects are never served. The Sharp/libvips worker performs bounded real decoding, rejects animation and unsupported formats/dimensions, applies orientation and re-encodes metadata-free WebP variants. Public reads additionally require a `ready` asset attached to an active listing. Decoder updates, worker isolation/resource limits, cleanup monitoring and malicious corpus tests remain launch gates.

## Privacy

Collect minimum data. Never publish email, IP, device identifiers, exact private address, internal risk state or private account data. Define retention/export/deletion before launch. Azerbaijan privacy/e-commerce obligations require qualified legal review before production.

An authenticated buyer may request the verified phone of a different seller only for an active listing. The exact number is returned in a private non-cacheable response, never embedded in public HTML, search, logs or the contact audit. Per-buyer access is recorded and bounded to reduce harvesting; data retention and seller visibility controls require launch review.

## Operations

Secrets live in environment/secret management; `.env` is ignored. Logs are structured and redact secrets/PII. Sensitive admin, role, moderation, ban and payment events are immutable/auditable. Backups are encrypted and restore-tested.

## Launch gates

Threat model, dependency and permission audit, abuse/rate-limit tests, backup restore, upload security tests, admin 2FA, headers/CSP, incident contacts and prohibited-items/legal policies.
