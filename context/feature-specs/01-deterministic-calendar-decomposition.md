# 01 — Deterministic Calendar Decomposition

Goal: convert one normalized calendar event into proposed Family OS blocks using pure synchronous logic.

Design decisions:
- No database.
- No API route.
- No Google SDK/provider import.
- No background worker.
- Core output must preserve source evidence and UNKNOWN semantics.
- Do not infer private facts from free text.

Implementation:
- Add a small normalized calendar-event input type.
- Add `decomposeCalendarEvent(...)` under `lib/family-os/`.
- Produce the primary protected calendar block deterministically.
- Create child/proposed blocks only from explicit structured inputs or explicit decomposition rules.
- Dirty/unparseable optional metadata must not throw; preserve UNKNOWN instead.

Verification:
- Add focused tests for normal event, missing optional data, protected event, and UNKNOWN metadata.
- Keep all existing 13 Family OS tests passing.
- `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and high-severity production audit must stay GREEN.

Out of scope: provider adapter, persistence, UI, notification policy, route planning, JDK mutation.