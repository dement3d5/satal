# Security and privacy baseline

## Identity

Better Auth is the initial session/auth framework with a phone-number plugin and provider adapter. Production SMS credentials/onboarding remain required. Store normalized E.164 phone data encrypted or access-restricted where practical; never expose it by default. Admin/owner require 2FA and stronger session controls.

Sessions use secure HttpOnly cookies, rotation, revocation and active-session management. Passwords use a modern memory-hard hash through the auth framework. OTP requests and attempts receive per-number, per-session and network risk limits without relying on IP alone.

## Authorization

Use capability-based RBAC for user, shop owner, moderator, support, admin and owner. Application services authorize both action and target ownership. Add integration tests for IDOR and privilege boundaries.

## Web/API controls

Validate server-side, escape output, apply CSP/security headers, CSRF defenses where cookies authorize mutations, strict CORS/trusted origins, request size/time limits and SSRF-safe outbound clients. Return safe errors with correlation IDs.

## Media

Uploads use short-lived server-authorized object keys. Quarantine until signature, size and dimensions are checked and images are safely decoded/re-encoded with metadata removed. Serve variants from a separate media origin. No video, voice, executables or arbitrary files in MVP.

## Privacy

Collect minimum data. Never publish email, IP, device identifiers, exact private address, internal risk state or private account data. Define retention/export/deletion before launch. Azerbaijan privacy/e-commerce obligations require qualified legal review before production.

## Operations

Secrets live in environment/secret management; `.env` is ignored. Logs are structured and redact secrets/PII. Sensitive admin, role, moderation, ban and payment events are immutable/auditable. Backups are encrypted and restore-tested.

## Launch gates

Threat model, dependency and permission audit, abuse/rate-limit tests, backup restore, upload security tests, admin 2FA, headers/CSP, incident contacts and prohibited-items/legal policies.
