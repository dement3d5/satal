# ADR 0016: leased media processing, retry and retention

## Status

Accepted.

## Context

The first image processor selected a bounded batch and changed each asset to `processing`, but had no ownership lease. A terminated process could strand an asset forever, two overlapping schedulers could race, and every decoder, database or object-storage error was treated as permanently invalid user content. Quarantine and deleted-variant cleanup also depended on manual operations. Moving business work into a broker would add cost and operational state before the MVP has measured a need.

## Decision

PostgreSQL remains the work source of truth. Each eligible `media_asset` has a processing availability timestamp and attempt count. A worker claims one row with `FOR UPDATE SKIP LOCKED`, changes it to `processing`, records an opaque worker ID and a ten-minute lease expiry, then performs decoding outside the transaction. Final state changes require the same live lease owner. An expired lease is eligible for another worker; deterministic variant keys and transactional metadata replacement make recovery idempotent.

Decoder, dimension, animation and format failures are permanent and move the asset to `rejected`. Quarantine reads, variant writes and persistence-finalization failures are operational failures: they return the asset to `quarantined` with exponential retry delay capped at one hour and a bounded error code. Raw exception text, object bytes, client filenames and quarantine keys are excluded from health output and structured worker records.

The same worker periodically expires unused upload authorizations, deletes quarantine objects after `ready`, `rejected` or `deleted`, and deletes stored variants only for assets already marked `deleted`. Object deletion is idempotent and PostgreSQL records successful quarantine removal. A privacy-safe aggregate health snapshot reports status counts, processable/retrying work, expired leases, expired uploads, cleanup backlog and oldest processable age.

Local `pnpm dev` starts the web and worker processes together. Production runs `pnpm media:worker` as a separately supervised process and uses `pnpm media:status` for an external health check. The R2 adapter still fails closed until credentials, least-privilege policy and a live lifecycle test are available.

## Consequences

- crashed and overlapping workers no longer strand or double-finalize database state;
- temporary infrastructure failure does not mislabel a seller's image as hostile;
- cleanup and health are repeatable without a broker or another source of state;
- deterministic object writes may be repeated after a lost lease, so adapters must preserve overwrite/delete idempotency;
- process isolation, alert delivery, malicious-file corpus testing and live R2 verification remain production launch prerequisites.
