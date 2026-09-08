import { NextResponse, type NextRequest } from 'next/server'
import { parseHouseholdMembership } from './lib/family-os/google-household-identity'
import {
  HOUSEHOLD_SESSION_COOKIE,
  resolveHouseholdSessionMember,
} from './lib/server/google-household-session'
import {
  SITE_GATE_COOKIE,
  SITE_GATE_SESSION_PARAM,
  cleanSiteGateSessionPath,
  siteGateAuthorized,
  siteGateConfig,
  siteGateSessionAuthorized,
  siteGateToken,
} from './lib/server/site-password-gate'

const PUBLIC_GATE_PATHS = new Set(['/signin', '/api/auth/google', '/unlock', '/api/site-unlock'])

function protectedHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

function unavailableResponse(message = 'Site access is temporarily unavailable.') {
  return new NextResponse(message, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}

function cleanSessionRedirect(request: NextRequest) {
  const cleanPath = cleanSiteGateSessionPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
  return protectedHeaders(NextResponse.redirect(new URL(cleanPath, request.url), 303))
}

async function legacyGateResponse(request: NextRequest) {
  const gate = siteGateConfig(process.env)
  if (!gate.enabled || !gate.accessCode || !gate.gateKey) return null

  const cookie = request.cookies.get(SITE_GATE_COOKIE)?.value
  const cookieAuthorized = await siteGateAuthorized(cookie, gate.accessCode, gate.gateKey)
  const sessionValue = request.nextUrl.searchParams.get(SITE_GATE_SESSION_PARAM)
  const sessionAuthorized = await siteGateSessionAuthorized(sessionValue, gate.gateKey, Date.now())

  if (cookieAuthorized) {
    return sessionValue ? cleanSessionRedirect(request) : protectedHeaders(NextResponse.next())
  }

  if (sessionAuthorized) {
    const response = cleanSessionRedirect(request)
    response.cookies.set(
      SITE_GATE_COOKIE,
      await siteGateToken(gate.accessCode, gate.gateKey),
      cookieOptions(request),
    )
    return response
  }

  return null
}

function googleAuthConfiguration() {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim() ?? ''
  const authSecret = process.env.DORANDORAN_AUTH_SECRET?.trim() ?? ''
  const membersJson = process.env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON?.trim() ?? ''
  const anyPresent = Boolean(clientId || authSecret || membersJson)
  const complete = Boolean(clientId && authSecret && membersJson)
  return { clientId, authSecret, membersJson, anyPresent, complete }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_GATE_PATHS.has(pathname)) return protectedHeaders(NextResponse.next())

  const googleConfig = googleAuthConfiguration()
  if (googleConfig.anyPresent && !googleConfig.complete) {
    return unavailableResponse('Google household access is temporarily unavailable.')
  }

  if (googleConfig.complete) {
    let membership
    try {
      membership = parseHouseholdMembership(process.env)
    } catch {
      return unavailableResponse('Google household access is temporarily unavailable.')
    }
    if (!membership.length) return unavailableResponse('Google household access is temporarily unavailable.')

    const token = request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value
    const member = await resolveHouseholdSessionMember(token, googleConfig.authSecret, membership, Date.now())
    if (member) {
      return request.nextUrl.searchParams.has(SITE_GATE_SESSION_PARAM)
        ? cleanSessionRedirect(request)
        : protectedHeaders(NextResponse.next())
    }

    const legacy = await legacyGateResponse(request)
    if (legacy) return legacy

    return protectedHeaders(NextResponse.redirect(new URL('/signin', request.url), 307))
  }

  const legacy = await legacyGateResponse(request)
  if (legacy) return legacy

  const gate = siteGateConfig(process.env)
  if (!gate.enabled) return unavailableResponse()

  const unlockUrl = new URL('/unlock', request.url)
  const cleanNext = request.nextUrl.clone()
  cleanNext.searchParams.delete(SITE_GATE_SESSION_PARAM)
  unlockUrl.searchParams.set('next', `${cleanNext.pathname}${cleanNext.search}`)
  return protectedHeaders(NextResponse.redirect(unlockUrl, 307))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
