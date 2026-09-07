# G9 — Route / Presence Operating Projection

Goal: add physical-world status to Today/Now without turning schedule truth into live-location truth.

## Presence
- Calendar place remains a separate `Scheduled` projection.
- Presence consumes an explicit `PresenceObservation` only.
- `confirmed_live` may render `Live` only with fresh evidence refs and a valid observation time.
- `last_known` stays `Last known`; it is never promoted to live.
- missing or invalid evidence fails closed to `Unknown`.

## Route
- Route consumes an existing `TransitionAssessment` plus explicit evidence refs.
- `proven_tight_fit` is clear/usable, not friction.
- meaningful watch state remains watch.
- actual friction remains friction.
- insufficient physical evidence remains unknown.

## Boundary
- no provider names in the core projection
- no raw GPS payloads or addresses in the client projection
- route and presence never overwrite Calendar NOW/NEXT truth
- a future adapter may supply private evidence behind this same boundary

## Acceptance
- focused RED → GREEN tests
- Today/Now can accept optional presence/route projections
- existing 124 tests stay GREEN
- build/audit/HyoDo stay GREEN
