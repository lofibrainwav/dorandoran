# D1 — Family Time Zoom + Specialist Bridge

Goal: one continuous Family OS view should zoom through time and space, then reveal a person-specific specialist runtime without duplicating that runtime.

## Product time axis
- Past Journey → Year → Month → This Week → Today → Now.
- `past` may remain the internal enum; user-facing language is `Past Journey`.
- Today/Now are operational views. Month/Year are pattern views. Past Journey is memory/history.

## Information zoom
- World → Region → Local → Place.
- Family → Person → Activity → Domain.
- Zooming into a person reveals only specialist modules actually declared for that person.
- Family OS never assumes every person has School/Learning modules.

## Jayden bridge
- Jayden learning remains a specialist runtime, not duplicated Family OS logic.
- Family OS can show schedule/activity summaries first, then link deeper into School/Learning when that capability is present.
- Core contracts use person ids and capabilities, never display-name branching.

## Truth boundary
- Calendar location is `Scheduled`, never `Live`.
- Live presence requires explicit authorized location evidence.
- Past Journey must not reuse a present-day location marker as if it were a memory observation.
- Missing location or learning data stays UNKNOWN until an adapter provides evidence.