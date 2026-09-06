# Chad Family OS ↔ JDK Learning Runtime — Bridge Contract v0.1

Status: DRAFT-GREEN

Tracking: JDK issue #6

## 1. Purpose

JDK Learning Runtime is the canonical Education/Learning execution domain inside Chad Family OS. It is not replaced by Family OS and must not become the SSOT for family scheduling, consent, physical logistics, or whole-family Goal closure.

## 2. Canonical ownership

| Domain | Canonical owner |
|---|---|
| Family intent / GoalContract | Family OS |
| Consent / authority / identity | Family OS |
| Calendar / protected time / physical handoff | Family OS |
| Next Best Block scheduling | One-Box Time Engine |
| Orchestration / recovery / minimal ask | Chad |
| Learning source Truth / provenance | JDK |
| Learning compiler / renderer | JDK |
| JaydenAdapter / LearningPlan | JDK |
| Parent Review learning gate | JDK |
| VerifiedLearningRelease | JDK |
| LearningEvent / learning verifier | JDK |
| Family Goal final closure | Family OS using readback evidence |

Rule: no representation may silently become canonical for another domain.

## 3. Integration shape

```text
Family Goal / homework source
        ↓
      Chad
 observe / recover / authority check
        ↓
LearningReviewRequestV1
        ↓
       JDK
 source extraction → proposal → compiler → Truth
        ↓
Parent Review (Together)
        ↓
VerifiedLearningReleaseV1
        ↓
FamilyLearningOpportunityV1
        ↓
One-Box / Next Best Block
        ↓
Jayden Practice Block
        ↓
       JDK
 LearningEvent / verifier
        ↓
LearningPracticeOutcomeV1
        ↓
Family OS readback
        ↓
Goal close / continue
```

## 4. Bridge boundaries

### 4.1 LearningReviewRequestV1

Family OS may request learning preparation only within a Goal and authority envelope.

```ts
export interface LearningReviewRequestV1 {
  version: 1
  requestId: string
  familyGoalId: string
  requestedByPersonId: string
  authorityRef: string
  sourceHandoffRef: string
  requestedAt: string
}
```

The request does not grant JDK authority over Gmail, Calendar, Photos, payments, or unrelated family data.

### 4.2 LearningReviewStatusV1

```ts
export interface LearningReviewStatusV1 {
  version: 1
  requestId: string
  state: 'pending_review' | 'approved' | 'rejected' | 'blocked'
  safeSummaryRef?: string
  releaseRef?: string
  evidenceState: 'confirmed' | 'unknown' | 'contradicted'
}
```

Only the safe parent-facing projection may cross into Family OS. Private source slices, `private://` references, raw evidence graphs, and review capsule plaintext do not cross the bridge.

### 4.3 VerifiedLearningReleaseV1

JDK remains canonical producer. Family OS consumes a safe release projection; it does not recreate the private Truth Judge.

Minimum projection:

```ts
export interface VerifiedLearningReleaseV1 {
  version: 1
  releaseId: string
  learningTaskId: string
  subject: string
  conceptId: string
  rendererId: string | null
  verifiedAt: string
  releaseReady: true
}
```

Any additional field must be explicitly classified safe for family planning projection.

### 4.4 FamilyLearningOpportunityV1

Family OS projects a verified release into a schedulable Opportunity.

```ts
export interface FamilyLearningOpportunityV1 {
  version: 1
  opportunityId: string
  releaseId: string
  familyGoalId: string
  ownerId: 'jayden'
  mode: 'together'
  title: string
  estimatedMinutes?: number
  energy?: 'low' | 'medium' | 'high'
  evidenceRefs: string[]
}
```

Rules:
- `estimatedMinutes` is UNKNOWN unless supported by JDK metadata or observed family history.
- Family OS must not infer learner ability labels from a renderer or subject name.
- `mode='together'` because Jayden performs the learning action while JDK/Chad supplies the digital environment.

### 4.5 LearningPracticeOutcomeV1

```ts
export interface LearningPracticeOutcomeV1 {
  version: 1
  releaseId: string
  practiceSessionId: string
  startedAt?: string
  endedAt?: string
  observableEventRefs: string[]
  verifierState: 'passed' | 'needs_more' | 'paused' | 'unknown'
  verifiedAt: string
}
```

This is evidence for Family Goal closure, not an automatic closure command.

## 5. Job decomposition

### Source already digitally available
- Chad job: DIGITAL — recover source, prepare authorized request, invoke JDK boundary.
- Parent review: TOGETHER — JDK prepares; Jay/Julie reviews/approves.
- Practice: TOGETHER — Jayden acts; JDK renders/verifies.

### Source exists only physically
- Handoff: PHYSICAL — parent/Jayden provides or captures source.
- After handoff, Chad resumes the DIGITAL job from the stored resume point.

## 6. Parent identity truth

Current JDK Parent session actor is generic `parent`. Therefore:
- generic Parent Review approval may be accepted as the JDK learning gate;
- it must NOT be projected as `approvedBy=Jay` or `approvedBy=Julie`;
- identity-specific Family OS consent requires a future actor mapping/auth contract.

This is a bridge blocker only for identity-specific authority claims, not for a generic MVP Parent Review gate.

## 7. Correction truth

Current JDK `Request correction` is a rejection state. It is not yet a resumable correction loop.

Do not project:
`rejected = correction completed`.

Future target:

```text
reject / request correction
        ↓
ContextPatch
  exact missing/wrong field
        ↓
JDK re-proposal / re-review
        ↓
resume same Family Goal
```

## 8. Goal closure truth

These are distinct:

```text
JDK task prepared        ≠ Family Goal complete
Parent approved          ≠ Family Goal complete
Practice page opened     ≠ Family Goal complete
Renderer finished        ≠ Family Goal complete
Verified outcome evidence + success criteria = eligible to close
```

Family OS owns the final decision using GoalContract success criteria and JDK readback evidence.

## 9. Scheduling rule

A verified release becomes an Opportunity, not an automatic calendar mutation.

Chad/One-Box considers:
- protected Calendar blocks;
- available minutes;
- current location where relevant;
- energy/context observations;
- due date / homework urgency;
- setup friction;
- recent learning support state only when JDK exposes an approved planning-safe signal.

Chad shows options. User choice remains authoritative unless prior scope explicitly delegates scheduling.

## 10. Cross-repo versioning

MVP integration must use an explicit schema version (`v1`).

Do not depend on direct source imports between repositories.
Preferred boundary order:
1. versioned API/event projection;
2. later, a separately governed shared contract package if needed;
3. never copy mutable domain internals into both repos.

During design, pin JDK's verified feature head. Production activation requires an integrated/landed head and fresh full gate.

## 11. Golden scenario

Parent has a homework PDF.

1. Family Goal exists: `Finish and understand homework`.
2. Chad finds the PDF in authorized digital context, or asks only for that missing source if not found.
3. Chad says: `제가 디지털로 준비해서 Parent Review까지 올릴 수 있어요. 할까요?`
4. User grants Goal scope.
5. Chad invokes JDK review preparation.
6. JDK extracts/proposes/Truth-checks and returns safe Parent Review.
7. Parent approves.
8. JDK returns VerifiedLearningRelease.
9. Family OS creates a Jayden learning Opportunity.
10. One-Box offers a suitable free block without moving protected events.
11. Jayden practices.
12. JDK returns observable outcome/verifier evidence.
13. Family OS closes or continues the Goal.
14. Chad reports what was done and what, if anything, remains.

## 12. BBVC gates

RED controls must prove:
- private JDK evidence cannot leak into Family projections;
- Family authority cannot be manufactured by a JDK release;
- Parent Review cannot be bypassed;
- rejected correction cannot be falsely called resolved;
- generic `parent` cannot be falsely attributed to Jay or Julie;
- releaseReady cannot imply Goal complete;
- Next Best Block cannot move protected Calendar events;
- missing duration remains UNKNOWN instead of invented;
- ContextPatch resumes from a saved point instead of restarting the Goal;
- exact integrated contract version is reported in readback.

Only after these boundaries are executable may the bridge be called GREEN.
