# G6 — Private Calendar Operating Source

Goal: read authorized local/private calendars on the server and feed the same Family Operating Read Model used by the public demo.

## Boundary
- OAuth client files and tokens stay server-only and never enter client props.
- Source config maps source keys to person ids explicitly; calendar names never imply identity.
- Raw descriptions are ignored by the operating projection.
- Calendar location remains Scheduled, never Live.
- Missing config returns unavailable/partial state instead of inventing data.

## Flow
Google/private calendar → server transport → normalized event → ContextObservation → Family Operating Read Model → UI.

## Runtime
- explicit IANA time zone is required for read windows
- the first Today/Now source projects timed events only; all-day truth remains in Family Week
- each source is isolated by its own token path/calendar id
- source failures are reported by source key without leaking credentials
- transport is injectable in tests; production default uses read-only Google Calendar API

## Acceptance
- source registry supports explicit subject ids
- private source tests run without network or credentials
- no token/client contents appear in projections
- all Family OS tests, build, audit, and HyoDo gates remain GREEN
