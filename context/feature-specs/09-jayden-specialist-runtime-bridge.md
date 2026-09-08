# G8 — Jayden Specialist Runtime Bridge

Goal: let Family OS reveal Jayden's specialist Learning runtime without copying learning logic or private learning truth into Family OS.

## Boundary
- Family OS owns the family/time/place shell.
- JDK owns learning task generation, verification, renderer choice, and learning evidence.
- Family OS receives only a module availability/status projection until delegated transport is ready.
- No JDK task prompt, response, private evidence, capsule, or parent-session data enters the family module summary.

## Current JDK transport truth
The verified JDK release endpoint is POST-only, parent-session protected, capsule-bound, and same-origin protected. No delegated Family OS bridge is configured yet.

Therefore Learning must render as `Bridge pending`, not as connected or live.

## Ready condition
Learning becomes ready only when the JDK transport decision is `ready` after those binding constraints are removed from the bridge path and delegated transport is configured.

## Delegated bridge status contract (2026-09-08)
Family OS derives the Learning state per request instead of from constants:

- `DORANDORAN_JDK_BRIDGE_URL` (https only) declares the delegated bridge; unset → `Bridge pending` with reason `DELEGATED_BRIDGE_MISSING`.
- `GET {DORANDORAN_JDK_BRIDGE_URL}/status` with optional `Authorization: Bearer ${DORANDORAN_JDK_BRIDGE_TOKEN}` must return
  `{ "parentSessionBound": boolean, "capsuleBound": boolean, "sameOriginBound": boolean }` (2 s timeout, no-store, redirects rejected, body ≤ 4 KB; the result is cached in-process for 20 s so a slow bridge never serialises page renders).
- All three false → `Connected`. Any true → `Bridge pending` with the reported binding reasons.
- Unreachable / non-2xx → `Bridge unreachable`; 401/403 → `Bridge unauthorized`; non-JSON, oversized or malformed body → `Bridge status invalid` (all state `unknown`, never Connected).
- No task prompt, response, capsule, or parent-session data ever crosses this contract. The JDK side of this endpoint is not implemented yet.

## Acceptance
- blocked and ready transport states are tested
- Family OS module rendering is data-driven
- no display-name branching enters universal core
- all tests, build, audit, HyoDo, and public privacy checks remain GREEN
