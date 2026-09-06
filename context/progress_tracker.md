# Progress Tracker

Active subsystem: Calendar ingestion/decomposition.
Active feature spec: `context/feature-specs/01-deterministic-calendar-decomposition.md`.

Reality now:
- Family OS core contracts/engines exist in `lib/family-os/`.
- Family OS core tests: 13 passing.
- lint/typecheck/build/security audit are GREEN locally.
- JDK private learning runtime is separately GREEN and must not be rebuilt here.
- No Family OS database is selected or required for this unit.

Technical decisions:
- Pure deterministic logic first.
- External provider adapter second.
- UI wiring third.
- Trigger.dev only for later genuinely long-running work.

Next focused step: implement deterministic calendar-event decomposition as a pure function plus tests.
Done when: new tests pass and all existing verification commands stay GREEN.