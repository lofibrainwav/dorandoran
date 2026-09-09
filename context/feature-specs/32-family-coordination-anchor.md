# Unit 32 — Family Coordination Anchor

> Ported 2026-09-09 from the 2026-09-07 WIP on `feature/chad-family-os-core-v0.1` (originally numbered Unit 23 there; 23 is `private-photo-snapshot` on main). Pure read model over `FamilyBlock`; no runtime or UI wiring in this slice.

## Goal
Preserve each person's personal schedule as separate truth while projecting a family week around one configurable anchor person.

## Laws
- The core must not hardcode a family member name.
- `anchor_personal` and `coordination_shared` sources may appear on the family timeline.
- `supporter_personal` sources remain personal constraints and are not copied into family truth.
- A time overlap is not automatically a family conflict.
- A supporter conflict exists only when that supporter is an explicit physical owner of the family block.
- Projection returns references to canonical blocks; it does not duplicate mutable event truth.

## RED controls
1. Parent personal blocks never become family timeline refs.
2. Explicit physical-owner overlap creates a coordination conflict.
3. Unrelated parent overlap creates no conflict.
4. Anchor source must belong to the configured anchor person.
5. Supplemental sources do not silently become family truth.

## Done
Tests, typecheck, lint, build, audit, privacy scan, then isolated commit.
