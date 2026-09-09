# Artifact Registry, Night Reconcile, and Daily Capsule v0

## Status

This feature defines a pure, deterministic read model. It does not claim that a
nightly job has been scheduled or that any artifact provider is connected.

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

## Out of scope

This is a **v0 read-model boundary**. Future persistence, canonical artifact
schema, provider adapters, external databases, cron/launchd, scheduler
emission, dependency additions, and external writes are out of scope. A caller
may invoke night reconcile explicitly; this slice does not perform that
invocation automatically.
