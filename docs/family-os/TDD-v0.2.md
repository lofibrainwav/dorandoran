# Chad Family OS — TDD / Golden Scenarios v0.2

Status: DRAFT-GREEN

## 0. Test reality

Current `one-box-mk` has no `test` script or test runner. W0 therefore defines executable behavior before touching package/lockfile. W1 should add a minimal test harness after Dependabot PR #4 is reconciled so package/lockfile changes do not collide.

Kingdom rule applied here: spec → RED control → minimal implementation → verification/readback. No behavior is GREEN because a UI looks right.

## 1. Contract tests

### T01 — Sunday first
Given a weekly view, day order must be:
`Sun, Mon, Tue, Wed, Thu, Fri, Sat`.

### T02 — Protected calendar blocks
Confirmed calendar events normalized as protected blocks cannot be moved by the Opportunity/Next Best Block planner unless an authorized calendar mutation explicitly changes them.

### T03 — Source override without silent blending
Given a recurring Family Calendar event with an old location and a newer direct provider message with a new location, the resolved projection may keep the calendar time and use the newer provider location, while retaining both evidence refs and marking the changed/stale fact.

### T04 — UNKNOWN != RISK
Missing location/map evidence must not automatically become `risk` or `friction`. It must remain `unknown` and enter recovery.

### T05 — Tight != Friction
Given:
- scheduled gap = 15m;
- route is close;
- family history shows the transition repeatedly works;
- preferred gap ≈ 15m;

Then:
- `tightness = high`;
- `friction = low`;
- `routineState = proven_tight_fit`.

### T06 — Deviation can change a proven routine
Given a proven route baseline, a meaningful current travel deviation may raise `watch` or `friction` without rewriting the historical baseline itself.

### T07 — Source text preservation
Translation must never replace source text. Both source reference and translated meaning must be independently accessible.

### T08 — Julie language bridge
For a supported English school/provider message, output must distinguish:
- Korean meaning;
- required action;
- deadline/time sensitivity;
- uncertainty;
- optional Julie-style English reply.

### T09 — Communication profile cannot invent facts
Changing Julie's tone/profile must not change factual fields extracted from source evidence.

### T10 — Capability != Authority
A Chad job with technical capability but no valid consent/authority must not mutate external state.

### T11 — Read != Send != Publish
A read grant cannot authorize send. Photo memory access cannot authorize blog/public publishing.

### T12 — Revoked/expired consent fails closed
Expired or revoked consent cannot authorize mutation.

### T13 — Digital/Physical separation
A task such as `put Purple Folder in backpack` cannot be completed by Chad. Chad may track/remind, but physical owner and digital executor remain distinct.

### T14 — Together stays human-in-loop
A taste/preference decision must not be silently converted into a Chad-only digital job.

### T15 — Goal closure requires success criteria
If a form is submitted but payment/confirmation remains required, `taskComplete` may be true while `goalComplete` must remain false.

### T16 — Digital handoff does not close physical reality
A digital form/PDF marked done cannot close a goal whose next required state is parent signature, child delivery or other physical action.

### T17 — Recover before ask
If relevant authorized sources remain unsearched, Chad must not create a human ContextPatch question yet.

### T18 — Minimal ContextPatch
When exactly one missing field blocks progress, Chad asks only for that field and reports what was already checked.

### T19 — Resume from pause point
After a ContextPatch is supplied, the job resumes from its recorded `resumePoint`. It must not restart unrelated completed research/actions.

### T20 — Human interruption budget
Non-urgent independent questions should be batchable. A low-value uncertainty that does not block the goal must not cause an immediate interruption.

### T21 — Idempotent external action
The same goal/run must not send the same email or create the same external calendar mutation more than once without explicit new intent.

### T22 — Readback required
Tool/API success alone cannot mark an external mutation verified. Source/remote readback or equivalent receipt evidence is required.

### T23 — Carryover applies to work, not protected reality
An unfinished flexible task may carry over. A confirmed historical calendar event itself must not be rolled into tomorrow as if it were an unfinished task.

### T24 — Status dimensions remain orthogonal
The same block can validly be:
- Evidence = `confirmed`
- Work = `hold`
- Tightness = `high`
- Friction = `low`

No single status/color may erase these dimensions in the canonical model.

### T25 — Person != Score
A person's recommendation profile must derive from observations. A fixed global ability score must not become canonical identity truth.

### T26 — Next Best Block respects capacity
An opportunity longer than available capacity or requiring unavailable tools/location must not be presented as an immediate-fit recommendation unless explicitly labeled as preparation/partial work.

### T27 — Empty time != productive time
Travel/setup/rest/transition constraints can make visually empty calendar space unavailable for a new focus block.

### T28 — User choice remains visible
Next Best Block engine should return several useful options when multiple fit, rather than silently forcing one task as the only valid action.

### T29 — Pattern lineage
When a family routine is updated by newer evidence, old pattern must become stale/superseded rather than silently overwritten.

### T30 — Evidence contradiction surfaces
Conflicting high-authority evidence must remain visible to reconciliation; the system must not manufacture a false confirmed result.

## 2. Golden Scenario A — ABA → Water Wings

### Input
- ABA ends 6:30 PM.
- Swim begins 6:45 PM.
- Different places.
- Map/route says close.
- Family observed history says 15m works well and 30m often creates waiting.

### Expected
- `scheduledGap=15`.
- `tightness=high`.
- `friction=low`.
- `routineState=proven_tight_fit`.
- no warning solely because gap is 15m.
- if current route deviates materially, show a temporary watch/action without rewriting baseline history.

## 3. Golden Scenario B — English teacher email → Julie bridge

### Input
Official English email requiring a signed form by Friday.

### Expected
- preserve original source;
- Korean explanation;
- explicit `sign form` action;
- Friday deadline;
- derived Julie physical block + Jayden delivery block if supported by evidence;
- optional English response uses Julie profile but facts remain source-grounded.

## 4. Golden Scenario C — missing piano contact

### Input
Goal: send a schedule-change email. Recipient address not directly provided.

### Required recovery
Search authorized:
- Julie Gmail;
- Jayden Gmail;
- calendar;
- contacts;
- prior sent messages/files as relevant.

### If still missing
Create one ContextPatch:
- tell user exactly what was checked;
- ask only for the missing address/source;
- accept typed address, photo, file or alternate source;
- resume at recipient-resolution/send flow rather than restart.

## 5. Golden Scenario D — two hours available

### Input
A person has approximately two free hours before the next protected event. Opportunity Pool contains digital, physical and together items.

### Expected
Chad evaluates capacity, location/tools, energy/context and friction and shows a small choice set, e.g.:
- Quick Win;
- Important;
- Growth / physical wellbeing / rest when appropriate.

Chad explains why each fits now. The user selects. Chad then applies the appropriate execution mode:
- Digital → offer to execute within authority;
- Physical → recommend timing/prep;
- Together → collaborate.

## 6. Golden Scenario E — registration with payment handoff

### Input
Goal: complete a registration that requires online form, human payment approval and confirmation.

### Expected flow
1. Chad researches/fills/prepares authorized digital parts.
2. Payment boundary becomes a precise Together/authority handoff.
3. User approves or declines.
4. If approved and action authority exists, continue.
5. Read confirmation/receipt.
6. Update related calendar state if appropriate.
7. Close Goal only when success criteria are evidenced.

## 7. Test implementation order

### W1A — pure domain tests
Implement first without real external APIs:
- T01–T05
- T10–T19
- T23–T30

Use deterministic fixtures. No live Gmail/Calendar/Map needed.

### W1B — adapters as ports
Define interface contracts for Calendar, Mail, Map, Contacts and Readback. Tests use fakes/stubs to prove recovery, authority and reconciliation behavior.

### W1C — current One-Box compatibility
Prove existing `TimeBlock` behavior can project from FamilyBlock/Opportunity without breaking:
- protected blocks;
- buffers;
- carryover;
- focus timeline.

### W2 — first connected vertical slice
Use actual authorized calendar/email evidence. Run one end-to-end Jayden weekly scenario with readback.

## 8. False-green controls

The following are explicitly not completion evidence:
- mock Google success animation;
- API/tool returned `success=true` without source readback;
- translated text without source ref;
- a 15m gap labeled risk without map/family evidence;
- a sent draft counted as recipient delivery;
- digital task done counted as physical goal done;
- missing evidence coerced to default healthy/confirmed.

## 9. W1 exit gate

W1 is GREEN only when:
- executable tests exist;
- pre-implementation RED is demonstrated for new contract behavior;
- minimal implementation makes those tests GREEN;
- lint/build/typecheck pass;
- no current One-Box core behavior regression is introduced;
- package/lockfile state is reconciled with Dependabot/security updates;
- no real external mutation is required yet.