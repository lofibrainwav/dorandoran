# Progress Tracker

Active subsystem: Calendar ingestion, live Family Week, and source reconciliation.
Active feature spec: `context/feature-specs/06-all-day-and-calendar-reconciliation.md`.

Reality now:
- Units 1–5 are GREEN: decomposition, Google adapters, Sunday-first UI, read-only OAuth smoke, live-local `/family`.
- Google all-day `date` events are now first-class truth with exclusive-end semantics.
- Week UI has a dedicated all-day lane; timed and all-day projections stay separate.
- Calendar-derived FamilyBlock IDs are namespaced by source evidence to avoid cross-calendar collisions.
- Multi-source merge preserves both records; matching title/time never causes guessed deduplication.
- Local Family Calendar token remains repo-external with mode 0600.
