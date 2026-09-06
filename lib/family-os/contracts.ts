export type EvidenceState = 'confirmed' | 'unknown' | 'stale' | 'contradicted' | 'inferred'
export type AuthorityState = 'auto' | 'recover' | 'gate_required' | 'blocked'
export type JobMode = 'digital' | 'physical' | 'together'
export type RoutineState = 'proven_tight_fit' | 'normal_fit' | 'watch' | 'friction' | 'unknown'

export interface EvidenceRef {
  id: string
  sourceType: 'calendar' | 'email' | 'contact' | 'file' | 'map' | 'web' | 'human' | 'photo' | 'system'
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
