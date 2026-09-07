import type { ConsentGrant } from './contracts.ts'

export type AuthorityDecision = {
  state: 'auto' | 'gate_required' | 'blocked'
  reason: string
}

export function resolveAuthority(input: {
  capable: boolean
  subjectId: string
  domain: ConsentGrant['domain']
  action: ConsentGrant['actions'][number]
  nowIso: string
  grant?: ConsentGrant
}): AuthorityDecision {
  if (!input.capable) return { state: 'blocked', reason: 'CAPABILITY_MISSING' }
  const grant = input.grant
  if (!grant) return { state: 'gate_required', reason: 'CONSENT_GRANT_MISSING' }
  if (grant.subjectId !== input.subjectId || grant.domain !== input.domain) {
    return { state: 'gate_required', reason: 'CONSENT_SCOPE_MISMATCH' }
  }
  if (grant.revokedAt) return { state: 'gate_required', reason: 'CONSENT_REVOKED' }
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(input.nowIso)) {
    return { state: 'gate_required', reason: 'CONSENT_EXPIRED' }
  }
  if (!grant.actions.includes(input.action)) {
    return { state: 'gate_required', reason: 'ACTION_NOT_GRANTED' }
  }
  if (grant.authority === 'blocked') return { state: 'blocked', reason: 'CONSENT_BLOCKED' }
  if (grant.authority === 'gate_required') return { state: 'gate_required', reason: 'HUMAN_GATE_REQUIRED' }
  return { state: 'auto', reason: 'AUTHORIZED' }
}
