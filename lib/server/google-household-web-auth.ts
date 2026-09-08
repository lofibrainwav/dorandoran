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

/**
 * Google Identity Services sometimes completes a redirect-mode sign-in with a
 * GET to login_uri carrying the ID token in the URL fragment
 * (#id_token=...&prompt=none) instead of a POST. Servers never see fragments,
 * so this tiny bridge page moves the token into the regular POST contract
 * (credential + double-submit g_csrf_token). It embeds no configuration and
 * never persists the token anywhere other than the immediate form post.
 */
export function buildGoogleRedirectBridgeHtml(postPath = '/api/auth/google'): string {
  const safePath = postPath.replace(/[^a-zA-Z0-9/_-]/g, '')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Signing in</title></head><body><noscript>Enable JavaScript to finish signing in.</noscript><script>(function(){var h=new URLSearchParams(location.hash.replace(/^#/,''));var t=h.get('id_token');history.replaceState(null,'',location.pathname);if(!t){location.replace('/signin?error=google');return;}var c=Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)),function(b){return('0'+b.toString(16)).slice(-2)}).join('');document.cookie='g_csrf_token='+c+'; path=/; secure; samesite=lax; max-age=300';var f=document.createElement('form');f.method='POST';f.action='${safePath}';function add(n,v){var i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i);}add('credential',t);add('g_csrf_token',c);document.body.appendChild(f);f.submit();})();</script></body></html>`
}
