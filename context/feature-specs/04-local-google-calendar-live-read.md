# 04 — Local Google Calendar Live Read

Goal: prove an authorized local READ-only Google Calendar path without weakening provider-neutral Family OS contracts or storing credentials in the repo.

Design decisions:
- Use a Family OS-specific local OAuth token outside the repo; never overwrite global ADC.
- Read-only scope: `https://www.googleapis.com/auth/calendar.readonly`.
- Existing installed OAuth client may be referenced by ignored `.env.local`; client secret/token never committed.
- Google REST API raw event shape is normalized through a dedicated adapter before Unit 1 decomposition.
- Local smoke only in this unit; production web OAuth remains separate and deferred.

Implementation:
- Add raw Google REST event adapter (`start.dateTime` / `end.dateTime`).
- Add one-time local auth script and read-only smoke script.
- Add ignored `.env.local` locally with external credential/token paths and target calendar ID.
- Smoke prints only counts/status, not family event contents.

Verification:
- RED tests for REST payload normalization, then GREEN.
- Existing 23+ tests, lint, typecheck, build, and audits stay GREEN.
- After human browser consent, local smoke must successfully read and decompose at least one event.

Out of scope: production OAuth callback, Calendar writes, token DB, Vercel secrets, UI live fetch.
