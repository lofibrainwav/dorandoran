# Unit 28 — Core lifecycle (Capture → Candidate → Human Decision → Task → Done)

## Approved intent

Family OS needed a single, small state machine for "things a person said or decided" that never lets an AI (`chad`) originate a Task on its own — every Task must trace back to an explicit human accept. Slices A1–A4 built that machine end to end (domain → persistence → API → minimal UI); A5 closes the loop by feeding its output into the existing `/family` OneBox timebox planner instead of building a second, parallel to-do surface.

## Core principle

**AI는 Candidate까지, Task는 사람.** (see `context/ai_workflow_rules.md`)

`chad`/AI may capture, propose, and surface a Candidate opportunity. Only a real human decision (`decideCandidate`, `decision.by !== 'chad'`) can turn a Candidate into a Task. `lib/family-os/lifecycle.ts` enforces this in code: `decideCandidate` throws `HUMAN_DECISION_REQUIRED` whenever `decision.by` is missing or equals `'chad'`, and `taskFromAcceptedCandidate` refuses any candidate whose `decision.kind !== 'accept'`.

## The lifecycle (A1–A4)

1. **Capture** (`CaptureEvent`) — a raw record of something a person said: `want | decision | fact | question | final_artifact`, with `statedText`, `evidenceRefs`, and `unknowns`. Only `want`/`decision`/`final_artifact` are "actionable" and can become a Candidate (`proposeCandidate`); `fact`/`question` never do.
2. **Candidate** (`Opportunity` + derived `CandidateState`) — a proposed piece of work (`proposed | accepted | declined | expired`, derived from `decision` and TTL age — never stored as its own column). `chad` may create and propose a Candidate; it may never decide one.
3. **Human Decision** — `decideCandidate(candidate, { by, at, kind, evidenceRef })`. Requires a non-`chad` `by` and a non-empty `evidenceRef`; a candidate can only be decided once.
4. **Task** (`FamilyBlock`, `workState: WorkState`) — created only from an accepted Candidate (`taskFromAcceptedCandidate`). Carries forward the candidate's evidence, owner, mode, and privacy scope. Work-state transitions (`open → in_progress/hold/risk`, `→ done`) are graph-checked by `transitionTask`; closing to `done` always requires `readbackEvidenceRefs`; a `chad`-executed task additionally requires an explicit consequential-action declaration and `auto` authority before it may even start.
5. **Done** — terminal; `taskToPlannerWish` returns `null` for a `done` task (nothing left to schedule).

### Persistence (A2) and API (A3)

- `db/migrations/0001_lifecycle.sql` — `lifecycle_capture` / `lifecycle_candidate` / `lifecycle_task`, each `NOT NULL privacy_scope` with a `CHECK`. `lib/server/lifecycle-store.ts` implements this against Postgres (and an in-memory fake with identical semantics) with optimistic concurrency (`version`) and privacy-scope-bounded reads only.
- `app/api/lifecycle/{capture,candidates,candidates/[id]/decide,tasks,tasks/[id]}` — five thin routes. The actor is always the household session (`personId`/`capturedBy`/`decision.by` are never taken from the request body). `GET /api/lifecycle/tasks?person={id}` returns `{ tasks: TaskRecord[] }` for one lane; `?scope=family` returns the family-wide projection.

### Privacy — three boundaries, enforced in `lib/family-os/lifecycle.ts`

1. **Write-time** (`validateCaptureWrite`) — an adult may proxy-write into a *child's* lane only; `professional` scope is writable only by an adult into their *own* lane, never proxied, never by a child.
2. **Read-authorization** (`canReadLifecycleItem`) — own lane: everything. A child viewer: only their own lane, ever. An adult viewer reading another lane: `family` always, plus `personal` only when that lane belongs to a child. `professional` is never visible outside its own lane, for anyone.
3. **Projection** (`projectFamilyLifecycle`) — the family-wide view keeps only `privacyScope === 'family'` items; an item with no scope is dropped, fail-closed.

### Minimal UI (A4)

`components/lifecycle-lane.tsx` (`LifecycleLane`) renders inside `/family`, behind the existing "더 보기" (`showContext`) toggle, next to `FamilyOperatingHero`: per-lane tabs, a one-line capture form, a Candidate accept/decline list, a Task work-state list, and a read-only family-wide view. All client-side gating (`canDecideCandidate`, `capturePrivacyScopeOptions`, `taskTransitionActions`, …) in `lib/family-os/lifecycle-ui.ts` is presentational only — the server re-checks every rule independently.

## A5 — Planner bridge

**Goal:** an Accepted Task that has a duration and is not yet `done` should show up as a "하고 싶은 일/해야 할 일" (`PlannerWish`) in the existing `/family` OneBox timebox planner, and ride the existing `schedulePlannerWishes` auto-placement and `exportTimeboxes` ICS export unchanged. No new API, no new enum, no new dependency.

### `lib/family-os/lifecycle-planner-bridge.ts`

- `lifecycleTasksToPlannerWishes(tasks, viewer)` — reuses A1's `taskToPlannerWish` (done / no duration / no owner already return `null` there; not reimplemented here). Adds two rules of its own:
  - **`hold` is excluded.** `hold` is a person's explicit "not now" decision on a Task; auto-placing it into a free calendar slot would override that decision. It naturally reappears as a wish the moment someone reopens it (`hold → open`).
  - **Own lane only, defense in depth.** The caller is required to fetch `/api/lifecycle/tasks?person={viewer.personId}` (the server's read-authorization boundary is the first line of defense), but the function also drops any task whose `personId !== viewer.personId` before mapping it. This is a fail-closed second check so that, for example, Julie's `professional` tasks can never end up on the shared family timetable even if a caller ever passed in a mixed array by mistake.
  - Every returned wish's `id` is namespaced `task:{taskId}` so it can never collide with a memo-derived id (`wish-0`, `wish-1`, …) that `parsePlannerMemo` produces.
- `mergePlannerWishes(memoWishes, lifecycleWishes)` — concatenates; on an id collision neither side is dropped ("lifecycle wins" was explicitly rejected — both stay, since `schedulePlannerWishes`/`exportTimeboxes` operate on arrays, not an id-keyed map).

### `components/family-planner.tsx`

- New optional prop `lifecycleViewer?: { personId, access } | null`. `app/family/page.tsx` passes the same resolved household-session member it already computes for `LifecycleLane` (`lifecycleViewerMember`).
- When present, a `useEffect` fetches `/api/lifecycle/tasks?person=...` (same `credentials: 'same-origin'`, `cache: 'no-store'`, `AbortSignal.timeout(15000)` pattern as `lifecycle-lane.tsx`), then calls `lifecycleTasksToPlannerWishes`. No viewer → no fetch. A failed fetch clears lifecycle wishes and shows one short Korean notice line; the memo flow keeps working exactly as before.
- The existing `wishes` memo (`parsePlannerMemo(saved.memo).map(...)`) is replaced by `mergePlannerWishes(parsePlannerMemo(saved.memo), lifecycleWishes).map(...)` — the duration-override step (`saved.durations[wish.id] ?? wish.minutes`) is untouched and applies uniformly to both origins, so adjusting an accepted task's duration in the planner behaves exactly like adjusting a memo line's duration.
- A wish row whose id starts with `task:` renders `수락한 일 · {owner}` in place of the normal owner/estimate hint, so it reads visibly differently from a memo line.
- **Read-only, no writes.** This bridge never calls `POST`/`PATCH` on any `/api/lifecycle/*` route and never changes a Task's `workState`. Auto-placement output (`plans`) is still written only to `localStorage`, exactly as before — zero external writes.

## Verification

- `tests/family-os/lifecycle-planner-bridge.test.mjs` (new, 7 cases): done/hold/no-duration exclusion, own-lane-only defense, `task:` id namespacing with a forced memo-id collision (both wishes survive), duration-override applying to a lifecycle wish, `required` true only for `priority: 'high'`, and a full round trip through the real `buildFamilyPlanner` + `schedulePlannerWishes`.
- `tests/family-os/family-week-render.test.mjs` updated to mock the new `@/lib/family-os/lifecycle-planner-bridge` import boundary with the real module (SSR render never runs `useEffect`, so no network call happens under test).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (470/470, up from 463), `pnpm build` all green — see PR/commit for exact output.

## Residual boundary

- A6+ (not built here): syncing an accepted task's duration edit back into the Task record, cross-device planner state, and any UI to place a Task's *specific* accepted time slot back onto the Task itself (today the planner's placement is a draft/ICS-export concept, not a Task field).
- The `owner` shown for a lifecycle wish is the raw household `personId`, capitalized (`julie` → `Julie`) to match the memo convention; it is not looked up against the richer `members`/`ownerLabel` display names already used elsewhere on the page, to keep this slice's surface area minimal.
