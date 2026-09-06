# Chad Family OS — Domain Contracts v0.2

Status: DRAFT-GREEN

This document defines canonical domain boundaries before production implementation. It is intentionally stricter than the current One-Box `TimeBlock` model.

## 1. Core enums

```ts
export type EvidenceState =
  | 'confirmed'
  | 'unknown'
  | 'stale'
  | 'contradicted'
  | 'inferred'

export type AuthorityState =
  | 'auto'
  | 'recover'
  | 'gate_required'
  | 'blocked'

export type WorkState =
  | 'hold'
  | 'open'
  | 'in_progress'
  | 'risk'
  | 'done'

export type JobMode = 'digital' | 'physical' | 'together'

export type GoalState =
  | 'open'
  | 'executing'
  | 'waiting_human'
  | 'waiting_external'
  | 'verifying'
  | 'closed'
  | 'blocked'

export type RoutineState =
  | 'proven_tight_fit'
  | 'normal_fit'
  | 'watch'
  | 'friction'
  | 'unknown'
```

## 2. EvidenceRef

```ts
export interface EvidenceRef {
  id: string
  sourceType:
    | 'calendar'
    | 'email'
    | 'contact'
    | 'file'
    | 'map'
    | 'web'
    | 'human'
    | 'photo'
    | 'system'
  sourceId?: string
  uri?: string
  observedAt: string
  state: EvidenceState
  rawValue?: unknown
  interpretation?: string
  confidence?: number
}
```

Rule: raw/source evidence must remain distinguishable from translation, interpretation, score and recommendation.

## 3. FamilyBlock

```ts
export interface FamilyBlock {
  id: string
  type: 'event' | 'action' | 'reminder' | 'decision' | 'auth'
  parentBlockId?: string

  reality: {
    title: string
    start?: string
    end?: string
    durationMinutes?: number
    location?: string
    recurrence?: string
  }

  evidenceRefs: string[]
  evidenceState: EvidenceState

  people: {
    subjectIds: string[]
    physicalOwnerIds: string[]
    approverIds: string[]
    recipientIds: string[]
  }

  digital: {
    executor?: 'chad'
    jobs: ChadJobRef[]
  }

  authorityRef?: string

  language?: LanguageBridgeState

  physicalReality?: PhysicalReality

  transition?: {
    tightness: 'low' | 'medium' | 'high' | 'unknown'
    friction: 'low' | 'medium' | 'high' | 'unknown'
    deviation: 'none' | 'small' | 'meaningful' | 'unknown'
    routineState: RoutineState
  }

  timeEngine: {
    protected: boolean
    bufferAfterMinutes?: number
    priority?: 'low' | 'medium' | 'high'
    energy?: 'low' | 'medium' | 'high'
    carryover?: boolean
    rolloverCount?: number
  }

  dependencyIds: string[]
  childBlockIds: string[]
  workState: WorkState

  closure?: {
    executedAt?: string
    readbackEvidenceRefs: string[]
    receiptRef?: string
    lessonRef?: string
  }
}
```

## 4. FamilyEdge

```ts
export interface FamilyEdge {
  id: string
  fromBlockId: string
  toBlockId: string
  relation:
    | 'prepares'
    | 'requires'
    | 'follows'
    | 'transports'
    | 'translates'
    | 'approves'
    | 'reminds'
    | 'verifies'
    | 'blocks'
  evidenceRefs: string[]
  state: EvidenceState
}
```

Edges are data, not decorative UI lines.

## 5. GoalContract

```ts
export interface SuccessCriterion {
  id: string
  description: string
  satisfied: boolean
  evidenceRefs: string[]
}

export interface GoalContract {
  id: string
  requestedBy: string
  intent: string
  desiredOutcome: string
  successCriteria: SuccessCriterion[]
  deadline?: string
  acceptableAlternatives?: string[]
  stopConditions?: string[]

  blockIds: string[]
  handoffIds: string[]
  authorityRefs: string[]

  state: GoalState

  closure: {
    taskComplete: boolean
    goalComplete: boolean
    evidenceRefs: string[]
    verifiedAt?: string
  }
}
```

Rule: `taskComplete=true` must never imply `goalComplete=true` without satisfied success criteria and readback evidence.

## 6. ConsentGrant

```ts
export interface ConsentGrant {
  id: string
  subjectId: string
  grantee: 'chad'

  domain:
    | 'gmail'
    | 'calendar'
    | 'photos'
    | 'contacts'
    | 'files'
    | 'location'
    | 'payments'
    | 'publishing'
    | 'other'

  actions: Array<
    | 'read'
    | 'search'
    | 'draft'
    | 'write'
    | 'send'
    | 'share'
    | 'publish'
    | 'execute'
  >

  scope?: string[]
  authority: Exclude<AuthorityState, 'recover'>

  grantedBy: string
  evidenceRef: string
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
}
```

Rules:
- permission is per person/account/domain/action scope;
- read != write != send != publish;
- memory permission != publishing permission;
- revoked/expired grant cannot authorize mutation.

## 7. ChadJob

```ts
export interface ChadJobRef {
  jobId: string
}

export interface ChadJob {
  id: string
  goalId: string
  mode: JobMode
  action:
    | 'observe'
    | 'translate'
    | 'classify'
    | 'compare'
    | 'research'
    | 'plan'
    | 'recommend'
    | 'draft'
    | 'execute'
    | 'remind'
    | 'verify'
    | 'learn'

  capability: string
  authorityState: AuthorityState
  authorityRef?: string
  requiredContext: string[]
  missingContext: string[]
  state: 'queued' | 'running' | 'paused' | 'done' | 'failed'
  resumePoint?: string
}
```

## 8. ContextPatch

```ts
export interface ContextPatch {
  id: string
  goalId: string
  jobId: string

  missingField: string
  searchedEvidenceRefs: string[]
  reasonNeeded: string
  requestedFrom: string
  minimalQuestion: string

  suppliedValue?: unknown
  suppliedEvidenceRef?: string
  resumePoint: string
  state: 'needed' | 'supplied' | 'resolved'
}
```

Rule: Chad may create a ContextPatch only after relevant authorized evidence recovery has been attempted or explicitly determined impossible.

## 9. Handoff

```ts
export interface Handoff {
  id: string
  goalId: string
  from: 'chad' | string
  to: 'chad' | string
  mode: JobMode
  description: string
  requiredBy?: string
  evidenceRefs: string[]
  state: 'open' | 'accepted' | 'done' | 'verified'
}
```

A Digital→Physical handoff does not close the parent Goal until physical reality is sufficiently verified.

## 10. InterruptionPolicy

```ts
export interface InterruptionPolicy {
  personId: string
  quietHours?: Array<{ start: string; end: string }>
  batchLowPriority: boolean
  immediateFor: Array<
    | 'deadline_risk'
    | 'safety'
    | 'authority_needed'
    | 'time_sensitive_decision'
  >
  preferredChannels?: string[]
  askThreshold: 'low' | 'normal' | 'high'
}
```

Decision order:
1. can Chad recover silently?
2. is the missing information actually blocking the Goal?
3. can the question be batched?
4. is a person uniquely able/authorized to answer?
5. ask the smallest possible question.

## 11. LanguageBridgeState

```ts
export interface LanguageBridgeState {
  sourceLanguage: string
  preferredLanguage: string
  sourceTextRef: string
  translatedMeaning?: string
  extractedActions?: string[]
  extractedDeadlines?: string[]
  uncertainties?: string[]
  communicationProfileRef?: string
  generatedReply?: string
}
```

Rule: generated reply must not invent facts from the communication profile.

## 12. PhysicalReality / RouteProfile

```ts
export interface PhysicalReality {
  mapNodeId?: string
  routeEdgeId?: string
  scheduledGapMinutes?: number
  travelEstimateMinutes?: number
  familyObservedMinutes?: number[]
  preferredGapMinutes?: number
  routineConfidence?: 'low' | 'medium' | 'high'
}

export interface RouteProfile {
  id: string
  originPlaceId: string
  destinationPlaceId: string
  baselineTravelMinutes?: { min: number; max: number }
  preferredGapMinutes?: number
  observedTravelMinutes: number[]
  parkingNotes?: string
  entryExitNotes?: string
  confidence: 'low' | 'medium' | 'high'
  validFrom?: string
  lastConfirmedAt?: string
  supersededBy?: string
}
```

Rule: a short scheduled gap is not friction by itself. Classification must preserve tightness, friction and routine confidence separately.

## 13. PersonProfile / observations

```ts
export interface PersonObservation {
  id: string
  personId: string
  dimension:
    | 'energy'
    | 'focus'
    | 'task_speed'
    | 'routine'
    | 'friction'
    | 'preference'
    | 'communication'
  statement: string
  evidenceRefs: string[]
  observedAt: string
  validFrom?: string
  lastConfirmedAt?: string
  supersededBy?: string
}
```

Rule: Person != Score. Scores/rankings are derived projections over observations for a specific decision.

## 14. Opportunity / Next Best Block

```ts
export interface Opportunity {
  id: string
  ownerId: string
  title: string
  mode: JobMode
  estimatedMinutes?: number
  priority?: 'low' | 'medium' | 'high'
  interest?: 'low' | 'medium' | 'high'
  growthValue?: 'low' | 'medium' | 'high'
  requiredLocation?: string
  requiredTools?: string[]
  evidenceRefs: string[]
}

export interface CapacitySnapshot {
  personId: string
  availableMinutes: number
  currentLocation?: string
  energy?: 'low' | 'medium' | 'high'
  availableTools?: string[]
  nextProtectedBlockAt?: string
  evidenceRefs: string[]
}

export interface NextBestBlockOption {
  opportunityId: string
  label: 'quick_win' | 'important' | 'growth' | 'rest' | 'other'
  fitReason: string[]
  frictionReason: string[]
  confidence: 'low' | 'medium' | 'high'
}
```

Chad shows options; the user keeps choice.

## 15. Memory reservation (post-MVP)

Photo is primarily a historical memory artifact, not a required live sensor.

```ts
export interface MemoryArtifact {
  id: string
  assetRef: string
  capturedAt?: string
  capturedLocation?: string
  relatedBlockIds: string[]
  relatedPlaceIds: string[]
  sourceMetadataRef?: string
  interpretation?: string
  tags?: string[]
}
```

Original metadata and AI interpretation remain separate. Future outputs can include Family Memory Map, blog, yearbook or travel story under separate publishing consent.

## 16. Projection rule

The same canonical objects may be projected into:
- Day timeline;
- Sunday-first Week calendar;
- Month summary;
- Year memory/planning view;
- Map/route view;
- Chad action queue;
- One-Box focus timeline.

Do not duplicate truth per view.