# 03 — Sunday-First Family Week Grid

Goal: render provider-neutral FamilyBlocks in a responsive Sunday-first weekly time grid without changing existing One-Box planning behavior.

Design decisions:
- Add isolated `/family` route; do not replace the One-Box home yet.
- Build pure week projection first, UI second.
- Sunday is day index 0; time is the vertical axis.
- Use generic mock FamilyBlocks only in this unit; no private family data in the public repo.
- No Google network fetch, writes, map, reminders, database, or background worker.
- Use `dvh` for mobile viewport stability; avoid decorative 3D/tilt effects.

Implementation:
- Add `projectWeekBlocks(...)` pure helper under `lib/family-os/`.
- Add focused projection tests for Sunday ordering and time placement.
- Add `FamilyWeekGrid` component driven only by FamilyBlocks.
- Add `/family` page using generic mock events.
- Keep protected/confirmed state visually distinguishable without conflating tightness/friction.

Verification:
- New projection tests plus all prior tests pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and production audit stay GREEN.
- `/family` is emitted by production build.

Out of scope: live Google auth/fetch, route map, Chad reminders/actions, Month/Year UI.
