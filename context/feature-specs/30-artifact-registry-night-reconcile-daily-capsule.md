# Artifact Registry, Night Reconcile, and Daily Capsule v1

## Status

The artifact registry remains a pure deterministic read model. Daily Capsule v1
adds a durable, privacy-safe projection written by the protected nightly
reconcile route; it does not make the artifact registry a provider store.

## Contract

`buildArtifactRegistry(observations)` accepts source-neutral immutable artifact
observations with an `id`, `kind`, content `digest`, caller-supplied ISO-like
`observedAt`, evidence state, and optional source/evidence provenance.

- Empty input is a valid empty snapshot.
- Missing identity, kind, digest, invalid timestamp, or invalid evidence state
  fails closed.
- One `id` with one digest converges to one deterministic record. Provenance is
  deduplicated and sorted; input order cannot change the result.
- One `id` with multiple digests produces a `conflict` record and a conflict id.
  No digest is selected as authoritative and no observation is overwritten.
- Registry records retain artifact identity and provenance, but provider payloads
  are not part of this contract.

`reconcileArtifactRegistries({ before, after, cutoff, now })` compares two
snapshots and returns versioned typed entries: `added`, `updated`, `unchanged`,
`stale`, or `conflict`. `cutoff` and `now` are required caller inputs; the
implementation reads no wall clock and contains no hard-coded freshness period.
An observation exactly at `cutoff` is not stale. An artifact present in the
previous snapshot but absent from the new snapshot is surfaced as `stale`. A
conflict remains conflict, including when it is also old, because uncertainty
must not be hidden.

`createDailyArtifactCapsule({ date, registry })` returns a versioned,
privacy-safe daily summary. It contains counts for every typed state and
stable-sorted `id`/`kind`/
`state` entries only. It never emits raw content, digest, URI, credential,
source payload, or private family text. `unknown`, `stale`, `contradicted`,
`inferred`, and `conflict` are not collapsed into healthy/confirmed.

## Evidence and privacy boundary

The registry is an observation read model, not canonical provider storage.
Evidence identity and provenance are retained for future reconciliation, while
the capsule is deliberately a narrower display/reporting projection. A source
adapter remains responsible for validating and supplying observations.

## Durable Daily Capsule

`family_daily_capsule` stores one versioned JSON projection per
`household_key + capsule_date`. The protected reconcile route computes the
previous household-local day from already-authorized family-scope lifecycle
rows and upserts the capsule. Re-running the same night is idempotent.

The stored projection contains counts and typed states only. It never stores
capture text, candidate titles, task blocks, credentials, provider payloads, or
artifact provenance. Candidate state is re-derived from its existing decision
and creation timestamp; no lifecycle state is mutated.

The authenticated capsule route prefers a sealed row and falls back to the
existing live projection while a migration is being rolled out.

## Out of scope

Canonical artifact schema, provider adapters, scheduler emission beyond the
existing protected Vercel cron, dependency additions, and external writes are
out of scope. Artifact persistence remains a separate future boundary.
