# G3 — Family Operating Read Model

Goal: make the hero consume one privacy-safe, provider-neutral read model instead of hand-built UI strings.

## Input
- reconciled `ContextObservation[]`
- target person id + display label
- current instant
- declared specialist modules
- optional already-reconciled watch/outcome text

## Output
- person id/label
- NOW and NEXT labels derived from evidence-backed schedule observations
- place state: Scheduled only from calendar/schedule truth; Live requires explicit presence evidence later
- optional coordinates only when supplied by the source observation
- declared specialist modules only

## Invariants
- observations for another person cannot leak into the projection
- missing place stays Unknown; no fallback location is invented
- UI does not parse provider payloads
- read model never duplicates Jayden Learning/JDK internals
- no exact private fixture is committed

## Acceptance
- focused tests go RED before implementation, then GREEN
- all Family OS tests remain GREEN
- typecheck/lint/build/audit/HyoDo remain GREEN
- UI public demo is created through this read model
