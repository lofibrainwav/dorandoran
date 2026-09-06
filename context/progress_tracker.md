# Progress Tracker

Active subsystem: Calendar ingestion/decomposition.
Active feature spec: `context/feature-specs/02-google-calendar-source-adapter.md`.

Reality now:
- Family OS core contracts/engines exist in `lib/family-os/`.
- Family OS core + calendar decomposition + Google adapter tests: 21 passing.
- lint/typecheck/build/security audit are GREEN locally.
- JDK private learning runtime is separately GREEN and must not be rebuilt here.
- No Family OS database is selected or required for this unit.

Technical decisions:
- Pure deterministic logic first.
- External provider adapter second.
- UI wiring third.
- Trigger.dev only for later genuinely long-running work.

Completed units: deterministic calendar decomposition and Google Calendar payload normalization are GREEN.
Next focused step: build a Sunday-first weekly time-grid view using provider-neutral FamilyBlocks; no live network fetch inside the UI unit.
Done when: UI tests/verification pass and all existing verification commands stay GREEN.