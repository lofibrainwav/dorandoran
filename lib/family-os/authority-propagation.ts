import type { Opportunity } from './contracts.ts'

/**
 * Unit 35 — Authority propagation. Turns a human acceptance (Unit 28 `decideCandidate`) into a
 * grant a machine can check, and decides whether a requested action falls inside it.
 *
 * Pure and deterministic: no I/O, no clock, no crypto import. The hash is injected so this file
 * stays inside `lib/family-os`'s browser-safe contract (this directory imports no `node:` module).
 *
 * This unit narrows how often a human must be asked. It never removes the asking — every path
 * that is not explicitly inside a live grant denies.
 *
 * Not a replacement for `authority.ts`: that one decides *whether an action needs a human gate at
 * all* (capability + consent, `auto | gate_required | blocked`). This one decides *whether an
 * approval already given covers this request*. Policy and evidence — they compose, in that order.
 */

/** What an approval binds: one verb, and the things it may touch. */
export interface AuthorityScope {
  action: string
  resources: readonly string[]
}

export interface AuthorityGrant {
  taskId: string
  candidateId: string
  /** Copied from the human decision — this unit never authors these three. */
  grantedBy: string
  grantedAt: string
  evidenceRef: string
  scope: AuthorityScope
  scopeDigest: string
  expiresAt: string
  nonce: string
}

export type AuthorityDenyReason =
  | 'GRANT_MISSING'
  | 'GRANT_NOT_HUMAN'
  | 'SCOPE_DIGEST_MISMATCH'
  | 'EXPIRED'
  | 'NONCE_REPLAYED'
  | 'ACTION_MISMATCH'
  | 'RESOURCE_OUTSIDE_SCOPE'

export type AuthorityDigest = (canonical: string) => string

export type AuthorityEvaluation =
  | { ok: true; ref: string }
  | { ok: false; reason: AuthorityDenyReason; detail?: string }

const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

function normalizedResources(resources: readonly string[]): string[] {
  return [...new Set(resources.map(String).filter((resource) => resource.trim() !== ''))].sort()
}

/**
 * Canonical form of a scope: `action` then its sorted, deduped resources, one per line.
 *
 * Sorting and dedup make the digest independent of caller ordering — the same normalization rule
 * KINGDOM's `scopeHash` uses, so a grant minted here stays verifiable downstream.
 */
export function canonicalAuthorityScope(scope: AuthorityScope): string {
  return [scope.action, ...normalizedResources(scope.resources)].join('\n')
}

/**
 * Mint a grant from an accepted candidate.
 *
 * The human decision is copied, never invented: Unit 28 already refused `by === 'chad'` and
 * required an `evidenceRef`, and that record is what makes this grant an approval rather than
 * an assertion.
 */
export function grantAuthorityFromAcceptedCandidate(input: {
  candidate: Opportunity
  taskId: string
  scope: AuthorityScope
  expiresAt: string
  nonce: string
  digest: AuthorityDigest
}): AuthorityGrant {
  const decision = input.candidate.decision
  if (decision?.kind !== 'accept') throw new Error('CANDIDATE_NOT_ACCEPTED')
  // 끝이 없는 승인은 상시 권한이다 — "결과 있는 행동은 사람이 그때그때 정한다" 와 정면으로 어긋난다.
  if (
    typeof input.expiresAt !== 'string' ||
    !ISO_8601_PATTERN.test(input.expiresAt) ||
    !Number.isFinite(Date.parse(input.expiresAt))
  ) {
    throw new Error('AUTHORITY_EXPIRY_REQUIRED')
  }
  const scope: AuthorityScope = {
    action: input.scope.action,
    resources: normalizedResources(input.scope.resources),
  }
  return {
    taskId: input.taskId,
    candidateId: input.candidate.id,
    grantedBy: decision.by,
    grantedAt: decision.at,
    evidenceRef: decision.evidenceRef,
    scope,
    scopeDigest: input.digest(canonicalAuthorityScope(scope)),
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  }
}

/**
 * Decide whether a request falls inside a live grant. Every branch fails closed.
 *
 * Check order matters: the digest is verified before the scope is read. If the two disagree, one
 * of them was edited after the grant was minted, and comparing the edited scope would answer the
 * wrong question — the widened scope would admit exactly what the edit was trying to smuggle in.
 */
export function evaluateAuthority(input: {
  grant: AuthorityGrant | null | undefined
  request: { action: string; resources: readonly string[] }
  now: string
  consumedNonces?: readonly string[]
  digest: AuthorityDigest
}): AuthorityEvaluation {
  const grant = input.grant
  // 결재의 부재는 결코 허가가 아니다.
  if (!grant) return { ok: false, reason: 'GRANT_MISSING' }

  if (typeof grant.grantedBy !== 'string' || grant.grantedBy.trim() === '' || grant.grantedBy === 'chad') {
    return { ok: false, reason: 'GRANT_NOT_HUMAN' }
  }

  if (input.digest(canonicalAuthorityScope(grant.scope)) !== grant.scopeDigest) {
    return { ok: false, reason: 'SCOPE_DIGEST_MISMATCH' }
  }

  if (Date.parse(input.now) > Date.parse(grant.expiresAt)) return { ok: false, reason: 'EXPIRED' }

  if ((input.consumedNonces ?? []).includes(grant.nonce)) return { ok: false, reason: 'NONCE_REPLAYED' }

  if (input.request.action !== grant.scope.action) return { ok: false, reason: 'ACTION_MISMATCH' }

  const granted = new Set(grant.scope.resources)
  const requested = normalizedResources(input.request.resources)
  // 대상을 말하지 않은 요청은 어떤 scope 안에도 있지 않다 — 빈 요청을 통과시키면 scope 검사가 무의미해진다.
  if (requested.length === 0) return { ok: false, reason: 'RESOURCE_OUTSIDE_SCOPE' }
  const outside = requested.filter((resource) => !granted.has(resource))
  if (outside.length > 0) return { ok: false, reason: 'RESOURCE_OUTSIDE_SCOPE', detail: outside.join(', ') }

  // 감사 손잡이이지 비밀이 아니다: 어느 Task 의 어느 1회용 결재가 이 행동을 들였는지 가리킨다.
  return { ok: true, ref: `authority:v1:${grant.taskId}:${grant.nonce}` }
}
