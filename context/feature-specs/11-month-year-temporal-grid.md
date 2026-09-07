# G10 — Month / Year Temporal Grid

Goal: let the same canonical Family observations zoom outward into Month and Year without creating a second calendar truth.

## Month
- fixed 6 × 7 Sunday-first grid (42 cells)
- spill days remain visible so Week → Month can morph without layout jumps
- each cell aggregates observation starts in the explicit IANA time zone
- subject filtering is optional and uses person ids, never names

## Year
- fixed 12-month grid
- each month aggregates the same observation stream
- no new event titles, priorities, or patterns are invented

## Truth rules
- the caller supplies `anchorLocalDate` plus IANA `timeZone`
- host machine time zone must not change the projection
- observations without a valid start are ignored, not guessed
- evidence refs are deduplicated per cell
- Month/Year are visual aggregation layers, not new SSOTs

## Acceptance
- month grid is always 42 Sunday-first cells
- year grid is always 12 cells
- explicit time zone decides the destination cell
- optional person filter excludes unrelated observations
- full test/build/audit/HyoDo stay GREEN
