export type ReconciledFactKind = 'start' | 'end' | 'location' | 'cancelled' | 'recurrence' | 'materials'
export type FactSourceRole = 'direct_official' | 'primary_calendar' | 'family_calendar' | 'memory'

export interface FactClaim {
  id: string
  fact: ReconciledFactKind
  value: string | boolean
  sourceRole: FactSourceRole
  evidenceRef: string
  observedAt: string
}

export interface ReconciledFact {
  fact?: ReconciledFactKind
  state: 'resolved' | 'conflict' | 'unknown'
  value?: string | boolean
  winnerClaimId?: string
  supersededClaimIds: string[]
  evidenceRefs: string[]
}

const sourceRank: Record<FactSourceRole, number> = {
  direct_official: 400,
  primary_calendar: 300,
  family_calendar: 200,
  memory: 100,
}

function timeValue(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
export function reconcileFactClaims(claims: FactClaim[]): ReconciledFact {
  if (claims.length === 0) {
    return { state: 'unknown', supersededClaimIds: [], evidenceRefs: [] }
  }

  const fact = claims[0].fact
  if (claims.some((claim) => claim.fact !== fact)) {
    throw new Error('MIXED_FACT_CLAIMS')
  }

  const sorted = [...claims].sort((a, b) => {
    const rankDelta = sourceRank[b.sourceRole] - sourceRank[a.sourceRole]
    if (rankDelta !== 0) return rankDelta
    return timeValue(b.observedAt) - timeValue(a.observedAt)
  })
  const winner = sorted[0]
  const topRank = sourceRank[winner.sourceRole]
  const topTime = timeValue(winner.observedAt)
  const tiedTop = sorted.filter((claim) =>
    sourceRank[claim.sourceRole] === topRank && timeValue(claim.observedAt) === topTime,
  )
  const topValues = new Set(tiedTop.map((claim) => JSON.stringify(claim.value)))

  if (topValues.size > 1) {
    return {
      fact,
      state: 'conflict',
      supersededClaimIds: [],
      evidenceRefs: claims.map((claim) => claim.evidenceRef),
    }
  }
  return {
    fact,
    state: 'resolved',
    value: winner.value,
    winnerClaimId: winner.id,
    supersededClaimIds: sorted.slice(1).map((claim) => claim.id),
    evidenceRefs: claims.map((claim) => claim.evidenceRef),
  }
}
