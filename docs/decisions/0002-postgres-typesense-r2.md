# ADR-0002: PostgreSQL source of truth, Typesense search, R2 media

Status: accepted

## Decision

Store business state in PostgreSQL, build a replaceable Typesense index, and store processed media in S3-compatible object storage (Cloudflare R2 in production).

## Why

PostgreSQL provides constraints and transactions; Typesense supplies typo-tolerant faceted search; R2 avoids database blobs and direct egress charges. All three fit a low-cost MVP and have migration paths.

## Consequences

Indexing is eventually consistent and requires an outbox, retries and rebuild command. Media processing and cleanup become explicit jobs. Search/media availability cannot be treated as the authoritative business state.
