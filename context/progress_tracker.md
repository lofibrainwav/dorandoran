# Progress Tracker

Active subsystem: Calendar ingestion/decomposition.
Active feature spec: `context/feature-specs/03-sunday-first-week-grid.md`.

Reality now:
- Family OS core contracts/engines exist in `lib/family-os/`.
- Family OS core + calendar + Google adapter + week projection tests: 23 passing.
- lint/typecheck/build/security audit are GREEN locally.
- JDK private learning runtime is separately GREEN and must not be rebuilt here.
- No Family OS database is selected or required for this unit.

Technical decisions:
- Pure deterministic logic first.
- External provider adapter second.
- UI wiring third.
- Trigger.dev only for later genuinely long-running work.

Completed units: deterministic calendar decomposition, Google Calendar normalization, and Sunday-first `/family` week-grid projection are GREEN.
Next focused step: design the authorized live Google Calendar READ boundary without weakening the current pure adapter/core contracts.
Done when: auth/env prerequisites are explicitly resolved and live read can be added without embedding credentials or private family fixtures.