# G4 — Today / Now Time Projection

Goal: make the local Today/Now hero answer not only WHAT is happening, but WHEN the current and next blocks occur.

## Input
- the already-reconciled person observations used by `Family Operating Read Model`
- observation `when.start`, `when.end`, and `when.timeZone`

## Output
- `nowWhen` for the active block when known
- `nextWhen` for the next block when known
- UI displays the next local clock time only when an explicit IANA time zone is present

## Invariants
- no browser-local or host-local timezone guessing
- missing time/timezone stays absent
- labels remain WHAT; time remains WHEN
- other-person schedule data remains excluded
- calendar place remains Scheduled, never Live

## Acceptance
- focused temporal test goes RED then GREEN
- UI consumes the structured WHEN field
- all Family OS tests and HyoDo gates stay GREEN
