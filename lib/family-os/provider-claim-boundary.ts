import type { PrivateGmailEnvelope } from './gmail-private-boundary.ts'
import type { FactClaim, ReconciledFactKind } from './fact-reconciliation.ts'

export interface ProviderIdentity {
  id: string
  verifiedEmails?: string[]
  verifiedDomains?: string[]
}

export interface ProviderObservation {
  id: string
  fact: ReconciledFactKind
  value: string | boolean
  explicit: boolean
  evidenceRef: string
}

const SUPPORTED_FACTS = new Set<ReconciledFactKind>([
  'start', 'end', 'location', 'cancelled', 'recurrence', 'materials',
])

function senderEmail(from: string | undefined): string | undefined {
  if (!from) return undefined
  return from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()
}

function isVerifiedSender(source: PrivateGmailEnvelope, provider: ProviderIdentity): boolean {
  const email = senderEmail(source.headers.from)
  if (!email) return false
  const domain = email.split('@')[1]
  const emails = new Set((provider.verifiedEmails ?? []).map((value) => value.trim().toLowerCase()))
  const domains = new Set((provider.verifiedDomains ?? []).map((value) => value.trim().toLowerCase()))
  return emails.has(email) || domains.has(domain)
}
function assertValidValue(observation: ProviderObservation): void {
  if (!SUPPORTED_FACTS.has(observation.fact)) throw new Error('PROVIDER_FACT_UNSUPPORTED')
  if (observation.fact === 'cancelled') {
    if (typeof observation.value !== 'boolean') throw new Error('PROVIDER_FACT_VALUE_INVALID')
    return
  }
  if (typeof observation.value !== 'string' || !observation.value.trim()) {
    throw new Error('PROVIDER_FACT_VALUE_INVALID')
  }
}

export function materializeProviderFactClaim(input: {
  source: PrivateGmailEnvelope
  provider: ProviderIdentity
  observation: ProviderObservation
}): FactClaim | null {
  const { source, provider, observation } = input
  if (!observation.explicit) return null
  if (observation.evidenceRef !== source.evidenceRef.id) {
    throw new Error('PROVIDER_EVIDENCE_MISMATCH')
  }
  if (!isVerifiedSender(source, provider)) {
    throw new Error('PROVIDER_SENDER_UNVERIFIED')
  }
  assertValidValue(observation)
  return {
    id: `provider:${provider.id}:${observation.id}`,
    fact: observation.fact,
    value: typeof observation.value === 'string' ? observation.value.trim() : observation.value,
    sourceRole: 'direct_official',
    evidenceRef: source.evidenceRef.id,
    observedAt: source.observedAt,
  }
}
