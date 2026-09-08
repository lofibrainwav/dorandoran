# G8 — Jayden Specialist Runtime Bridge

Goal: let Family OS reveal Jayden's specialist Learning runtime without copying learning logic or private learning truth into Family OS.

## Boundary
- Family OS owns the family/time/place shell.
- JDK owns learning task generation, verification, renderer choice, and learning evidence.
- Family OS receives the delegated bridge state plus a privacy-minimized readback of approved-release projections; the current UI exposes only the approved-release count.
- No JDK task prompt, response, private evidence, capsule, or parent-session data enters the family module summary.

## Current JDK transport truth (updated 2026-09-08)
The parent release endpoint (`POST /api/parent-released-practice`) stays parent-session protected, capsule-bound, and same-origin protected. It is never the Family OS transport.

JDK now also exposes a *delegated* transport for Family OS: `GET /api/family-bridge/releases`, bearer-token only, read-only, serving approved-release projections (`releaseId`, `taskId`, `subject`, `conceptId`, `rendererId`, `approvedAt`) from a private-server ledger. It is backed by a persistent parent review ledger, so an approved release exists server-side rather than only inside one browser tab.

`GET /api/family-bridge/status` reports all three bindings as `false` only when that ledger is configured on the JDK side; otherwise it keeps reporting the bound parent path, and Learning must render as `Bridge pending`.

## Ready condition
Learning is shown as connected only when the JDK status decision is `ready` and the approved-release readback also succeeds. A status-only success must never hide an unauthorized, unreachable, or malformed `/releases` response.

## Delegated bridge status contract (2026-09-08)
Family OS derives the Learning state per request instead of from constants:

- `DORANDORAN_JDK_BRIDGE_URL` (https only) declares the delegated bridge; unset → `Bridge pending` with reason `DELEGATED_BRIDGE_MISSING`.
- `GET {DORANDORAN_JDK_BRIDGE_URL}/status` with optional `Authorization: Bearer ${DORANDORAN_JDK_BRIDGE_TOKEN}` must return
  `{ "parentSessionBound": boolean, "capsuleBound": boolean, "sameOriginBound": boolean }` (2 s timeout, no-store, redirects rejected, body ≤ 4 KB; the result is cached in-process for 20 s so a slow bridge never serialises page renders).
- All three false makes the status side ready. Any true → `Bridge pending` with the reported binding reasons.
- `GET {DORANDORAN_JDK_BRIDGE_URL}/releases` uses the same bearer and returns only the approved-release projection contract. Family OS validates the response, caps accepted response size, caches it briefly, and exposes only the approved-release count in the current UI.
- Unreachable / non-2xx → `Bridge unreachable`; 401/403 → `Bridge unauthorized`; non-JSON, oversized or malformed responses → `Bridge status invalid` (all state `unknown`, never Connected).
- No task prompt, response, capsule, or parent-session data ever crosses this contract. Implemented on the JDK side (lofibrainwav/JDK, `api/family-bridge/status.ts`, `api/family-bridge/releases.ts`).

## Acceptance
- blocked and ready transport states are tested
- approved-release readback is bearer-authenticated and fail-closed
- Family OS module rendering is data-driven
- no display-name branching enters universal core
- all tests, build, audit, HyoDo, and public privacy checks remain GREEN
