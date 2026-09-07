# Progress Tracker

Active subsystem: Calendar ingestion and live Family Week projection.
Active feature spec: `context/feature-specs/05-live-family-week-source.md`.

Reality now:
- Family OS core contracts/engines are implemented in `lib/family-os/`.
- Deterministic decomposition, Google connector/REST adapters, and Sunday-first week projection are GREEN.
- Local read-only OAuth is authorized with a repo-external 0600 token.
- Live Google REST smoke reads the current Family week and decomposes timed events into FamilyBlocks.
- `/family` uses live local Calendar when authorized config exists, otherwise public-safe demo fallback.
- JDK private learning runtime remains a separate GREEN domain behind a bridge contract.
Current verification:
- Family OS tests: 29 passing.
- lint/typecheck/Next production build/security audit are GREEN locally.
- Live smoke uses exact Sunday → next Sunday exclusive boundary.
- No family titles, descriptions, locations, addresses, tokens, or client secrets are printed by smoke scripts.

Known gap promoted to next unit:
- All-day events are not yet projected; future school closures/trips must not be silently dropped.
- Multi-source reconciliation (Family Calendar + Jayden primary + provider/school evidence) is not yet implemented.

Completed units: 1 decomposition, 2 Google connector adapter, 3 Sunday-first UI, 4 read-only live smoke, 5 live-local `/family` source.
Next focused step: calendar source reconciliation + all-day truth, then Gmail/provider override integration.
