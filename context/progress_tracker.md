# Progress Tracker

Active subsystem: Calendar live-read boundary.
Active feature spec: `context/feature-specs/04-local-google-calendar-live-read.md`.

Reality now:
- Family OS core + deterministic decomposition + Google adapters + week projection are GREEN.
- Family OS tests: 26 passing.
- `/family` Sunday-first projection builds and renders.
- lint/typecheck/build/security audit are GREEN locally.
- Local Google REST adapter for `start.dateTime` / `end.dateTime` is GREEN.
- Family OS-specific read-only OAuth auth/smoke scripts are prepared.
- `.env.local` points only to external local credential/token paths and the target Family calendar; it is gitignored.
- No Calendar write scope exists in this unit.

Technical decisions:
- Do not overwrite global gcloud ADC.
- Keep local OAuth token outside the repository with file mode 0600.
- Print only smoke counts/status, never family event contents.
- Production web OAuth remains a later, separate boundary.

Next focused step: one-time human Google browser consent for Calendar read-only access, then run the live smoke.
Done when: authorized live read normalizes and decomposes at least one timed Family Calendar event without exposing event contents.
