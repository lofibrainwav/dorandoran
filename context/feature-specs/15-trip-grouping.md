# Unit 15 — Past Journey Trip Grouping

Group confirmed memory observations by time gap without inventing trip names.

## Source law
- Operate only on confirmed canonical `memory` observations.
- Core grouping is structural, not semantic.
- The caller supplies the maximum temporal gap policy.
- Memories without valid capture time stay outside temporal groups.
- Schedule observations and unrelated subjects stay outside the group.

## Flow
ContextObservation(kind=memory) → chronological filter → gap partition → TripGroup.

## Acceptance
- deterministic chronological grouping
- positive configurable `maxGapMs`
- exact boundary remains in the same group
- only explicit place refs are preserved
- no semantic trip label is generated
- canonical evidence refs stay out of later client projections
