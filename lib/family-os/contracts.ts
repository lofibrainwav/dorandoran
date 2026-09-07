export type EvidenceState = 'confirmed' | 'unknown' | 'stale' | 'contradicted' | 'inferred'
export type AuthorityState = 'auto' | 'recover' | 'gate_required' | 'blocked'
export type JobMode = 'digital' | 'physical' | 'together'
export type WorkState = 'hold' | 'open' | 'in_progress' | 'risk' | 'done'
export type RoutineState = 'proven_tight_fit' | 'normal_fit' | 'watch' | 'friction' | 'unknown'

export interface EvidenceRef {
  id: string
  sourceType: 'calendar' | 'email' | 'contact' | 'file' | 'map' | 'web' | 'human' | 'photo' | 'system'
  sourceId?: string
  uri?: string
  observedAt: string
  state: EvidenceState
  interpretation?: string
  confidence?: number
}

export interface ConsentGrant {
  id: string
  subjectId: string
  grantee: 'chad'
  domain: 'gmail' | 'calendar' | 'photos' | 'contacts' | 'files' | 'location' | 'payments' | 'publishing' | 'other'
  actions: Array<'read' | 'search' | 'draft' | 'write' | 'send' | 'share' | 'publish' | 'execute'>
  scope?: string[]
  authority: 'auto' | 'gate_required' | 'blocked'
  grantedBy: string
  evidenceRef: string
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
}

export interface SuccessCriterion {
  id: string
  description: string
  satisfied: boolean
  evidenceRefs: string[]
}

export interface GoalContract {
  id: string
  desiredOutcome: string
  successCriteria: SuccessCriterion[]
  closureEvidenceRefs: string[]
}

export interface RecoveryAttempt {
  source: string
  attempted: boolean
  evidenceRefs: string[]
  unavailableReason?: string
}

export interface ContextPatch {
  goalId: string
  jobId: string
  missingField: string
  searchedEvidenceRefs: string[]
  minimalQuestion: string
  resumePoint: string
  state: 'needed' | 'supplied' | 'resolved'
}

export interface RouteProfile {
  scheduledGapMinutes?: number
  liveTravelMinutes?: number
  baselineTravelMinutes?: { min: number; max: number }
  observedTravelMinutes: number[]
  preferredGapMinutes?: number
  routineConfidence: 'low' | 'medium' | 'high'
}

export interface TransitionAssessment {
  tightness: 'low' | 'medium' | 'high' | 'unknown'
  friction: 'low' | 'medium' | 'high' | 'unknown'
  deviation: 'none' | 'small' | 'meaningful' | 'unknown'
  routineState: RoutineState
  slackMinutes?: number
  reasons: string[]
}

export interface Opportunity {
  id: string
  ownerId: string
  title: string
  mode: JobMode
  kind?: 'task' | 'rest'
  estimatedMinutes?: number
  setupMinutes?: number
  transitionMinutes?: number
  requiredEnergy?: 'low' | 'medium' | 'high'
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  interest?: 'low' | 'medium' | 'high'
  growthValue?: 'low' | 'medium' | 'high'
  requiredLocation?: string
  requiredTools?: string[]
  evidenceRefs: string[]
}

export interface CapacityObservation {
  id: string
  tags: string[]
  effect: 'supports' | 'cautions'
  evidenceRef: string
}

export interface CapacitySnapshot {
  personId: string
  availableMinutes: number
  currentLocation?: string
  energy?: 'low' | 'medium' | 'high'
  availableTools?: string[]
  observations?: CapacityObservation[]
  evidenceRefs: string[]
}

export interface NextBestBlockOption {
  opportunityId: string
  label: 'quick_win' | 'important' | 'growth' | 'rest' | 'other'
  fitReason: string[]
  frictionReason: string[]
  confidence: 'low' | 'medium' | 'high'
}

export interface VerifiedLearningReleaseV1 {
  version: 1
  releaseId: string
  taskId: string
  title: string
  verifiedAt: string
  releaseReady: true
  estimatedMinutes?: number
  evidenceRefs: string[]
}

export interface LearningPracticeOutcomeV1 {
  version: 1
  releaseId: string
  verifierPassed: boolean
  observedAt: string
  evidenceRefs: string[]
}

export interface ChadJobRef {
  jobId: string
}

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

export interface PhysicalReality {
  mapNodeId?: string
  routeEdgeId?: string
  scheduledGapMinutes?: number
  travelEstimateMinutes?: number
  familyObservedMinutes?: number[]
  preferredGapMinutes?: number
  routineConfidence?: 'low' | 'medium' | 'high'
}

export interface FamilyBlock {
  id: string
  type: 'event' | 'action' | 'reminder' | 'decision' | 'auth'
  parentBlockId?: string
  workMode?: JobMode
  reality: {
    title: string
    start?: string
    end?: string
    durationMinutes?: number
    location?: string
    recurrence?: string
    allDay?: boolean
  }
  evidenceRefs: string[]
  evidenceState: EvidenceState
  people: {
    subjectIds: string[]
    physicalOwnerIds: string[]
    approverIds: string[]
    recipientIds: string[]
  }
  digital: { executor?: 'chad'; jobs: ChadJobRef[] }
  authorityRef?: string
  language?: LanguageBridgeState
  physicalReality?: PhysicalReality
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

export interface ExplicitCalendarAction {
  id: string
  title: string
  mode: JobMode
  physicalOwnerIds?: string[]
  approverIds?: string[]
  recipientIds?: string[]
  jobId?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface NormalizedCalendarEvent {
  id: string
  title: string
  description?: string
  start?: string
  end?: string
  durationMinutes?: number
  location?: string
  recurrence?: string
  allDay?: boolean
  protected?: boolean
  evidence: EvidenceRef[]
  subjectIds?: string[]
  physicalOwnerIds?: string[]
  approverIds?: string[]
  recipientIds?: string[]
  explicitActions?: ExplicitCalendarAction[]
}
