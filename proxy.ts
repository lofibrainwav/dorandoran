import { NextResponse, type NextRequest } from 'next/server'
import { parseHouseholdMembership, type HouseholdMember } from './lib/family-os/google-household-identity'
import { decideHouseholdAccess, PUBLIC_ACCESS_PATHS } from './lib/server/household-access-decision'
import {
  HOUSEHOLD_SESSION_COOKIE,
  resolveHouseholdSessionMember,
} from './lib/server/google-household-session'

// Google household identity is the only way in. The legacy site-password gate was retired on 2026-09-08 (spec 25H).

function protectedHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

function unavailableResponse(message = 'Google household access is temporarily unavailable.') {
  return new NextResponse(message, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function googleAuthConfiguration() {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim() ?? ''
  const authSecret = process.env.DORANDORAN_AUTH_SECRET?.trim() ?? ''
  const membersJson = process.env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON?.trim() ?? ''
  return { authSecret, complete: Boolean(clientId && authSecret && membersJson) }
}

function loadMembership(): HouseholdMember[] | null {
  try {
    return parseHouseholdMembership(process.env)
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_ACCESS_PATHS.has(pathname)) return protectedHeaders(NextResponse.next())
  if (process.env.NODE_ENV !== 'production' && process.env.CHAD_LOCAL_PREVIEW === '1' &&
      (request.nextUrl.hostname === '127.0.0.1' || request.nextUrl.hostname === 'localhost')) {
    return protectedHeaders(NextResponse.next())
  }

  const googleConfig = googleAuthConfiguration()
  const membership = googleConfig.complete ? loadMembership() : null
  const token = request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value
  const sessionMember = membership && membership.length
    ? await resolveHouseholdSessionMember(token, googleConfig.authSecret, membership, Date.now())
    : null

  const decision = decideHouseholdAccess({ pathname, googleComplete: googleConfig.complete, membership, sessionMember })
  switch (decision.kind) {
    case 'next':
      return protectedHeaders(NextResponse.next())
    case 'redirect':
      return protectedHeaders(NextResponse.redirect(new URL(decision.to, request.url), decision.status))
    default:
      return unavailableResponse()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
