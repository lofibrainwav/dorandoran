import type { HouseholdMember } from '../family-os/google-household-identity.ts'

export type HouseholdAccessDecision =
  | { kind: 'next' }
  | { kind: 'redirect'; to: '/signin'; status: 307 }
  | { kind: 'unavailable' }

export const PUBLIC_ACCESS_PATHS: ReadonlySet<string> = new Set(['/signin', '/api/auth/google'])

/**
 * Pure access gate for every non-public route. Google household identity is the only door:
 * incomplete configuration, unparsable or empty membership all fail closed as unavailable.
 */
export function decideHouseholdAccess(input: {
  pathname: string
  googleComplete: boolean
  membership: HouseholdMember[] | null
  sessionMember: HouseholdMember | null
}): HouseholdAccessDecision {
  if (PUBLIC_ACCESS_PATHS.has(input.pathname)) return { kind: 'next' }
  if (!input.googleComplete) return { kind: 'unavailable' }
  if (!input.membership || input.membership.length === 0) return { kind: 'unavailable' }
  if (input.sessionMember) return { kind: 'next' }
  return { kind: 'redirect', to: '/signin', status: 307 }
}
