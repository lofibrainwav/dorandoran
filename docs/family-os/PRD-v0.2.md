# Jayden Family Calendar OS / Chad — MVP PRD v0.2

Status: DRAFT-GREEN (architecture converged, implementation not started)

## 1. North Star

Chad watches the digital world so each family member can move through the physical world with less friction, while preserving human choice, authority, language, memory, and real-world goal closure.

Short form:

> Past is remembered. Present is understood. Future friction is prepared for.

For MVP, the primary product surface is the family calendar. Photo/memory is intentionally deferred to a later wave but reserved in the domain model.

## 2. Product identity

- **Family Calendar** = primary time reality / source of scheduled commitments.
- **One-Box** = reusable TimeBlock engine for protected time, available capacity, planning, buffers, carryover and focus.
- **Chad** = digital house orchestrator / resolver / translator / recommender / verifier.
- **Map** = physical-space reality for places, routes, transition fit and deviations.
- **Human family members** = owners of preference, physical action, taste, consent and final high-impact decisions.

Chad does not replace the family. Chad removes avoidable digital friction so the family can act more easily.

## 3. Primary users

### Jay
Needs a concise view of the week, problems worth attention, useful options for open time, and clear physical handoffs.

### Julie
Needs accurate English↔Korean understanding, especially for school/provider communication, plus natural English drafting that preserves Julie's own communication style.

Rule: **facts come from evidence; tone comes from Julie's communication profile.**

### Jayden
Needs short, concrete, age-appropriate instructions. Parent briefs must not be dumped into Jayden's view.

### Chad
Performs: Observe → Translate → Resolve → Forecast → Plan → Recommend → Act → Remind → Verify → Learn.

## 4. MVP user promise

On a Sunday-first weekly calendar, the family can see real commitments and Chad can:

1. reconcile current calendar/email/provider evidence;
2. distinguish Digital / Physical / Together work;
3. explain English sources in Korean and prepare natural English replies;
4. evaluate transitions with map + family history rather than gap length alone;
5. show useful Next Best Block options when capacity appears;
6. perform delegated digital work to the defined goal boundary;
7. recover missing context before interrupting a person;
8. ask for only the missing personal fact/decision/authority when self-recovery fails;
9. resume from the exact pause point after a ContextPatch;
10. verify reality before marking a goal closed.

## 5. Non-negotiable product laws

### 5.1 Calendar first
Every scheduled family event begins as a calendar event block. Actions are derived from the event; Chad must not invent a replacement calendar reality.

### 5.2 Capability != Authority
The fact that Chad can technically perform an action does not grant permission. Authority comes from explicit person/account/action scope.

### 5.3 UNKNOWN != BLOCK != GREEN
Missing evidence is not success and not failure. Chad recovers evidence first. Only a real boundary becomes a human gate/block.

### 5.4 Tight != Friction
A short gap can be an excellent routine. Transition quality must use map reality, family observed history, preferred gap and current deviation.

### 5.5 Task complete != Goal complete
Digital completion is not enough when a physical handoff, payment, approval, external confirmation or reality readback remains.

### 5.6 Human interruption is expensive
Chad searches connected evidence first, batches low-value questions, and asks only the smallest unresolved piece needed to continue.

### 5.7 Original evidence != AI interpretation
Source text, calendar facts, map observations and future photo metadata must remain separate from translation, inference, scoring and recommendation.

## 6. Core product loop

```text
USER INTENT
   ↓
GOAL CONTRACT
   ↓
CONSENT / AUTHORITY
   ↓
CHAD DECOMPOSES
Digital / Physical / Together
   ↓
EXECUTE WHAT IS AUTHORIZED
   ↓
FRICTION?
   ├─ researchable → RECOVER
   ├─ missing personal fact → CONTEXT PATCH
   ├─ preference/taste → HUMAN CHOICE
   ├─ authority boundary → GATE
   └─ physical action → HANDOFF
   ↓
CONTINUE
   ↓
REALITY READBACK
   ↓
GOAL CLOSED
   ↓
REPORT + LEARN
```

## 7. Week calendar MVP

- Sunday is the first column.
- Time is the vertical axis.
- Existing confirmed events are protected.
- Empty time is available capacity, not automatically productive time.
- Selecting an event reveals derived action blocks and transition context.
- Owner/status/evidence/authority must be separate visual semantics.

## 8. Digital / Physical / Together

### Digital
Examples: read/search, translate, compare, classify, draft, document creation, calendar preparation/update within authority, research, coding, verification.

When Chad can complete the entire defined digital goal within authority, Chad may ask once: **"이건 제가 디지털로 끝까지 처리할 수 있어요. 할까요?"** If granted, the grant applies to the defined goal/scope rather than one click at a time.

### Physical
Examples: drive, exercise, pack a bag, sign paper, wear swimsuit, hand a folder to a teacher, attend class.

Chad cannot perform the physical action, but can calculate a good time, reduce setup friction, prepare the digital side, remind only when useful, and later seek appropriate completion evidence.

### Together
Human judgment/taste/authority plus Chad's research/execution. Examples: vibe coding, selecting a provider, approving a payment, choosing among schedule options, reviewing a design.

## 9. Opportunity Pool and Next Best Block

Users can put in:
- must do;
- want to do;
- someday/maybe;
- growth activities;
- Chad-discovered preparation work.

Chad does not merely rank a to-do list. Chad shows a small set of useful options based on current capacity and friction.

Initial Next Best Block inputs:
- available minutes;
- energy/context fit;
- location;
- tools available;
- urgency/priority;
- interest/growth value;
- setup/switch/travel friction;
- upcoming protected commitments.

Recommended presentation: 1–3 options such as Quick Win / Important / Growth, while preserving user choice.

Optimization target is not maximum work volume. It is useful outcome with low avoidable friction and sustainable energy.

## 10. Person profile

A person is not a single score. Store observations and derive projections when needed.

Profile dimensions:
- preferred language and communication style;
- observed energy/focus/task patterns;
- routine strengths and friction sensitivities;
- location/tool context when explicitly available;
- interruption preferences;
- consent references;
- preference history.

Patterns must support validity, last-confirmed and superseded state so old routines do not become permanent truth.

## 11. Language Bridge

Pipeline:

```text
SOURCE TEXT
  ↓
TRANSLATED MEANING
  ↓
ACTION / DEADLINE / QUESTION EXTRACTION
  ↓
PERSON-SPECIFIC EXPLANATION
  ↓
OPTIONAL REPLY DRAFT
```

Never overwrite original source text with translation.

For Julie, the system should explain:
- what the source means;
- what action is needed;
- deadline/time sensitivity;
- what is uncertain;
- a natural English reply in Julie's style when needed.

## 12. Map / Physical Reality

Transition classification uses separate observations:
- scheduled gap;
- route/travel estimate;
- parking/entry/exit/setup where known;
- family observed travel time;
- preferred gap;
- routine confidence;
- live/current deviation when available.

Example: ABA 6:30 → Water Wings 6:45 can be `tightness=HIGH`, `friction=LOW`, `routine=PROVEN_TIGHT_FIT` when map + family history support it.

Chad primarily watches for **deviation from a proven family baseline**, not generic gap length.

## 13. Consent and authority

Consent/authority is scoped by:
- subject/person;
- account/domain;
- action (`read`, `search`, `draft`, `write`, `send`, `share`, `publish`, etc.);
- scope;
- grant evidence;
- expiry/revocation.

Examples:
- memory access permission does not imply public blog publishing permission;
- Julie Gmail read permission does not automatically imply send permission;
- system ownership by Jay does not imply impersonation authority for Julie.

Just-in-time auth can later use provider-supported OAuth/passkey/device/QR approval flows, but MVP contract must remain provider-agnostic.

## 14. Recover First + ContextPatch

When blocked by missing context:

1. search all already-authorized relevant sources;
2. record what was checked;
3. identify the exact missing field;
4. ask only that field if it is genuinely personal/unavailable;
5. accept a value/photo/file/choice as a patch;
6. resume from the recorded pause point.

Good question pattern:

> "Julie Gmail, Jayden Gmail, Family Calendar, Contacts와 이전 기록을 확인했는데 이 한 정보는 찾지 못했어요. 제가 놓친 자료가 있을까요? 이 값만 주시면 중단한 곳부터 바로 이어갈게요."

## 15. Interruption Budget

Default behavior:
- no meaningful change → silent;
- recoverable uncertainty → recover quietly;
- low-priority questions → batch;
- useful preparation → gentle reminder;
- approaching real problem → clear action;
- human decision/authority truly required → minimal ask.

## 16. Goal closure

A Goal contains explicit desired outcome and success criteria. Goal state must distinguish:
- open;
- executing;
- waiting_human;
- waiting_external;
- verifying;
- closed;
- blocked.

Example registration closure:
- form submitted;
- required payment approved/completed;
- confirmation received;
- calendar updated if appropriate.

Only then may `goalComplete=true`.

## 17. MVP source priority

Initial connected evidence hierarchy should be configurable, not hard-coded globally. For Jayden weekly scheduling, a sensible initial policy is:
1. direct official provider/teacher/school message for explicit current changes;
2. current Family Calendar for recurring schedule time;
3. primary calendar event;
4. other connected evidence;
5. remembered/inferred routine only as labeled fallback.

Contradiction must be surfaced, not silently blended.

## 18. MVP in scope

- Sunday-first weekly calendar model/view;
- actual calendar adapter boundary;
- FamilyBlock / FamilyEdge / Goal contracts;
- Digital/Physical/Together classification;
- evidence/source reconciliation;
- English↔Korean bridge contract;
- authority/consent contract;
- Recover First + ContextPatch;
- Interruption Budget;
- map-aware transition model;
- Opportunity Pool + Next Best Block v0;
- idempotency and readback rules.

## 19. Explicitly deferred

- whole iCloud/Apple Photos indexing;
- Family Memory auto-ingestion;
- blog publishing automation;
- complete Month and Year interfaces;
- full Apple Shortcuts automation suite;
- continuous live GPS tracking;
- autonomous payments/purchases;
- broad unsupervised cross-platform browser actions.

These are future projections over the same core model, not separate products.

## 20. MVP acceptance

MVP is not GREEN until real connected data proves one end-to-end vertical slice including:
- family calendar read;
- event normalization;
- evidence reconciliation;
- language bridge where applicable;
- map/transition evaluation;
- Digital/Physical/Together decomposition;
- authority check;
- minimal ask on unresolved personal context;
- action/handoff;
- source readback;
- idempotent closure.

See `TDD-v0.2.md` for executable behavior targets.