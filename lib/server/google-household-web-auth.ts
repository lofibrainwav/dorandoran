import { google } from 'googleapis'
import {
  resolveHouseholdMember,
  type GoogleIdentityClaims,
  type HouseholdMember,
} from '../family-os/google-household-identity.ts'

export type GoogleIdTokenVerifier = (input: {
  credential: string
  clientId: string
}) => Promise<GoogleIdentityClaims>

async function defaultVerifyIdToken(input: {
  credential: string
  clientId: string
}): Promise<GoogleIdentityClaims> {
  const client = new google.auth.OAuth2()
  const ticket = await client.verifyIdToken({
    idToken: input.credential,
    audience: input.clientId,
  })
  const payload = ticket.getPayload()
  return { sub: payload?.sub, email: payload?.email }
}

export const DENIED_IDENTITY_LOG_FLAG = 'DORANDORAN_LOG_DENIED_IDENTITY'

/**
 * Operational discovery hook: when DORANDORAN_LOG_DENIED_IDENTITY=1 (Preview only),
 * a denied sign-in logs the verified Google sub so an operator can add the
 * household member without ever committing the value to the repository.
 * Off by default; never logs the credential itself.
 */
export function reportDeniedIdentity(
  claims: GoogleIdentityClaims,
  reason: 'unknown' | 'child',
  env: Record<string, string | undefined>,
  log: (message: string) => void,
): void {
  if (env[DENIED_IDENTITY_LOG_FLAG]?.trim() !== '1') return
  const sub = typeof claims.sub === 'string' && claims.sub.trim() ? claims.sub.trim() : '(missing)'
  const domain = typeof claims.email === 'string' && claims.email.includes('@') ? claims.email.split('@')[1] : '(none)'
  log(`[household-auth] denied reason=${reason} sub=${sub} emailDomain=${domain}`)
}

export async function verifyGoogleHouseholdCredential(input: {
  credential: string
  clientId: string
  membership: HouseholdMember[]
  verifyIdToken?: GoogleIdTokenVerifier
  env?: Record<string, string | undefined>
  log?: (message: string) => void
}): Promise<{ googleSub: string; member: HouseholdMember } | null> {
  const credential = input.credential.trim()
  const clientId = input.clientId.trim()
  if (!credential || !clientId) return null

  const claims = await (input.verifyIdToken ?? defaultVerifyIdToken)({ credential, clientId })
  const member = resolveHouseholdMember(claims, input.membership)
  if (!member || !member.canSignIn) {
    reportDeniedIdentity(claims, member ? 'child' : 'unknown', input.env ?? process.env, input.log ?? console.warn)
    return null
  }

  return { googleSub: member.googleSub, member }
}
