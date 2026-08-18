# ADR-0003: Better Auth and provider-neutral external adapters

Status: accepted

Implemented in foundation: Better Auth core tables and phone flow are wired to a provider port. The only current SMS adapter is deliberately disabled and throws; production readiness requires a real provider, credentials, abuse controls and end-to-end verification.

## Decision

Use Better Auth for secure session/account primitives and its phone-number flow, wrapped by Satal application services. SMS, email, push, payments and moderation vendors are accessed through narrow adapters selected by environment.

## Why

Phone-first authentication is required, but provider onboarding and regional economics are external decisions. A maintained auth framework reduces custom security code while adapters prevent vendor lock-in and fake readiness.

## Consequences

Provider credentials and production verification remain owner prerequisites. Framework upgrades require security review. Satal-specific roles, audit, abuse controls and authorization remain application responsibilities.
