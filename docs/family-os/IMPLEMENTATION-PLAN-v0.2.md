# Chad Family OS — Implementation Plan v0.2

Status: READY FOR W1 AFTER CONTRACT REVIEW

## Current repository reality

- Base main SHA: `8fc5086f049ea0f2c2c2458c9b4e41728fe1f56b`
- Existing useful engine: One-Box planner/time blocks/protected calendar/buffer/carryover/focus UI.
- Existing weakness: Google integration is mock; test runner absent; selected date limited to today/tomorrow; no Family/Goal/Authority/Map contracts.
- Open dependency/security PR #4 touches package + lockfile. Do not add test dependencies on a conflicting base without reconciling it first.

## Architecture placement

```text
One-Box Time Engine
  └─ protected time / capacity / buffer / carryover / focus

Family OS Domain
  └─ Goal / FamilyBlock / FamilyEdge / Evidence / Consent / Handoff

Chad Engine
  └─ recover / reconcile / classify / recommend / execute / verify

Adapters
  ├─ Calendar
  ├─ Gmail
  ├─ Contacts
  ├─ Map
  └─ later Apple/Photos/Shortcuts

Views
  ├─ Day
  ├─ Sunday-first Week
  ├─ Month (later)
  ├─ Year (later)
  └─ Memory (later)
```

Do not make UI components the SSOT. Views are projections over canonical domain objects.

## W0 — Contract lane (this branch)

Deliverables:
- PRD v0.2
- Domain Contracts v0.2
- TDD + Golden Scenarios v0.2
- this implementation plan

Rule: no production app behavior change.

Exit: contract review accepted; next RED test wave is unambiguous.

## W1 — Domain + test foundation

### W1.0 Security/dependency reconciliation
Before changing package/lockfile:
- inspect/merge/rebase around Dependabot PR #4;
- ensure main uses current security-patched dependency state;
- create fresh implementation branch from updated main.

### W1.1 Add test harness
Prefer a small TypeScript-friendly unit runner with minimal repo churn. Add scripts:
- `test`
- optionally `test:watch`
- `typecheck` if absent

Do not mix unrelated dependency upgrades with Family OS implementation.

### W1.2 Add canonical domain types
Recommended new area:

```text
lib/family-os/
  contracts.ts
  evidence.ts
  authority.ts
  goal.ts
  transition.ts
  opportunity.ts
  reconciliation.ts
```

Do not expand `lib/types.ts` into a giant mixed SSOT if a bounded Family OS domain module is clearer.

### W1.3 RED controls first
Implement executable tests for:
- status orthogonality;
- capability != authority;
- recover before ask;
- ContextPatch resume;
- task != goal closure;
- tight != friction;
- pattern supersession;
- next-best-block capacity filtering;
- protected calendar block immutability.

Record at least one pre-fix RED result for each behavior family.

### W1.4 Minimal pure engines
Implement no connectors yet:
- `resolveAuthority()`
- `reconcileEvidence()`
- `classifyTransition()`
- `decomposeGoal()`
- `createContextPatch()`
- `evaluateGoalClosure()`
- `rankNextBestBlockOptions()`

All functions should accept explicit inputs and return deterministic outputs. Avoid implicit global state.

## W2 — Adapter boundary + real Family Calendar read

Define ports first:

```ts
interface CalendarPort {}
interface MailPort {}
interface ContactPort {}
interface MapPort {}
interface ReadbackPort {}
```

Then connect the minimum real data path needed for one Sunday-first Jayden week.

First vertical slice:
1. read actual authorized calendars;
2. normalize events into FamilyBlock;
3. reconcile explicit provider changes;
4. render/provide Sunday-first week model;
5. no external write required yet.

Failure rule: missing Family Calendar/source access must surface PARTIAL/UNKNOWN, never fabricated completeness.

## W3 — Language Bridge + Recover First

Add:
- source preservation;
- English→Korean meaning/action/deadline extraction;
- Julie communication profile as style-only projection;
- connected-source recovery chain;
- ContextPatch minimal ask;
- resume point.

Golden Scenario B and C must pass end-to-end with fakes first, then connected read paths.

## W4 — Map / Physical Reality

Add:
- Place/Map nodes;
- RouteProfile;
- transition classifier;
- family-observed preferred gap/history;
- deviation layer.

Golden Scenario A is the acceptance anchor.

Rule: generic map travel estimate and family lived history remain separate evidence.

## W5 — Opportunity / Next Best Block

Reuse One-Box capacity concepts while adding:
- Opportunity Pool;
- CapacitySnapshot;
- Digital / Physical / Together classification;
- 1–3 recommendation options;
- fit/friction explanation;
- user selection.

Do not optimize for maximum task count. Include rest/wellbeing when that is the better capacity fit.

## W6 — Goal execution / handoff / readback

Add mutation only behind authority:
- delegated digital execution;
- external-action idempotency;
- Digital→Physical/Together handoff;
- waiting_human / waiting_external states;
- source readback;
- closure report.

Golden Scenario E is the acceptance anchor.

## W7 — Family Week UI

Once domain behavior is proven:
- Sunday-first columns;
- time-axis vertical calendar;
- protected event blocks;
- derived Digital/Physical/Together child views;
- optional map relation expansion;
- evidence/authority/work/transition status displayed as separate semantics.

Avoid reusing the rejected static Canva layout as product architecture.

## W8 — Month / Year projections

Same canonical data, different zoom. No duplicate Month/Year truth stores.

## W9 — Apple / Photo / Memory

After MVP:
- Apple Shortcuts handoff/capture workflows;
- photo metadata as historical evidence;
- MemoryArtifact / trip/place reconstruction;
- blog/yearbook generation under separate publish consent.

Photo is primarily memory/history, not required live tracking.

## Parallel lanes

Safe parallel work after W1 contract stabilization:

```text
Lane A: Domain/TDD
Lane B: Week UI prototype against fixtures
Lane C: Google adapter research/auth boundary
Lane D: Map/RouteProfile adapter research
```

Do not let B/C/D define canonical types independently. Lane A owns contracts until a deliberate contract change is accepted.

## First implementation PR sequence

Recommended small PRs:
1. `test: add Family OS test harness + RED contract fixtures`
2. `feat: add Family OS canonical contracts + pure decision engines`
3. `feat: add Sunday-first week projection from fixture calendar data`
4. `feat: add calendar/mail adapter ports and first connected read slice`
5. `feat: add map transition and proven routine classifier`
6. `feat: add opportunity / next best block v0`
7. `feat: add goal execution handoff/readback gate`

No mega-PR.

## Definition of Done

A change is not Done because:
- UI renders;
- mock says success;
- tool returns success;
- Chad drafted something.

Done requires the acceptance criteria for that PR plus tests/build/lint and, for external mutation, source readback/receipt.

## Immediate next move

After W0 draft PR review:
1. reconcile dependency/security PR #4;
2. branch fresh from updated main;
3. add test harness only;
4. land RED controls for the first pure domain family;
5. implement minimum code to make those controls GREEN.
