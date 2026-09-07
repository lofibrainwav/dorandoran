# G5 — Operating Coordination Projection

Goal: make WATCH and HANDOFF structured, evidence-backed projections instead of free-text UI guesses.

## WATCH
- consumes a verified `WeekEventInsight`
- confirmed insight stays quiet
- changed/cancelled/recover/action becomes a small privacy-safe badge projection
- exposes only state, badge label/tone, hint ids, and evidence refs
- never exposes raw mail text or event description

## HANDOFF
- consumes an existing `HandoffContract`
- exposes id, state, fromMode, toMode, and evidence refs
- does not expose raw handoff description in the client projection
- pending/completed are not treated as verified

## Hero rule
- render WATCH only when projected
- render HANDOFF only when a handoff projection exists
- do not create a handoff merely because two events are close together

## Acceptance
- focused tests go RED then GREEN
- public demo no longer uses arbitrary WATCH free text
- all Family OS tests and HyoDo gates stay GREEN
