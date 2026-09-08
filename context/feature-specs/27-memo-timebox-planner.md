# Unit 27 — Memo-first family timebox planner

## Approved intent

Commander requested a bright weekly planner based on the supplied reference image: write wants and must-do tasks in one memo, keep actual calendar facts locked, place new work in the remaining time, and show a usable map. Publishing and production verification were explicitly authorized on 2026-09-08.

Domain ownership confirmed by Commander: `dorandoran.link` is Family OS; `brnestrm.com` is Agentic OS and is outside this change.

## Implemented contract

- Existing household calendar observations remain immutable. Person-scoped context remains available as an optional secondary view.
- One memo line becomes one wish; explicit durations are preserved, unspecified durations visibly start at an editable 30 minutes. Must-do lines precede wants.
- Scheduling uses the household calendar timezone, future gaps only, 15 minutes around fixed events and 10 minutes between new tasks, including across time-band boundaries. All-day constraints block automatic placement for that date. Unplaced wishes remain in the memo.
- Automatic placement and export re-read calendar availability through an authenticated, private/no-store GET endpoint. Failure preserves drafts and does not invent availability.
- Drafts and memo are browser-local, not shared family persistence. Export is an explicit ICS download for manual Google/Apple Calendar import; it is not direct calendar writeback.
- MapLibre now shows attributed OpenStreetMap raster tiles, normal viewport loading only. The map-specific request sends origin-only referrer per tile policy. Failure presents an external map link; calendar functionality does not depend on map availability.
- Existing login does not imply additional OAuth grants. Current locally inspected Calendar grant is read-only. Apple Calendar/Reminders, Google Tasks/Gmail and cross-device memo sync remain unconnected and are labeled as such.

## Verification

- RED reproduced missing 10-minute rest across time-band boundaries; regression then GREEN.
- Domain coverage includes timezone, all-day/exclusive-end, UNKNOWN, overlap, priority, duration, Korean assignee and ICS escaping.
- Actual page/client render tests cover household facts and private identifier exclusion.
- Availability route tests cover authentication-before-provider-read, no-store and sanitized provider failure.
- Authenticated local browser: real calendar facts retained; three synthetic memo tasks placed; reload retained drafts; forced availability failure preserved all three and prevented scheduling; physical button click recovered after network restoration.
- Street tiles visually verified. Mobile 390 px viewport has no document overflow; weekly grid scrolls within its own region.
- HyoDo quality gates passed before final additional route test; final gate and remote production evidence recorded in closeout.

## Provider references

- https://operations.osmfoundation.org/policies/tiles/
- https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/

## Residual boundary

This is a working planning baseline, not completion of the requested full Google/Apple metadata ecosystem. Additional consented connectors and shared storage need a separate scoped implementation. Do not call this ecosystem fully connected or treat imported plans as already saved.
