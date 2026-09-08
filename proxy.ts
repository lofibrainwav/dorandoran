import { NextResponse, type NextRequest } from 'next/server'
import {
  SITE_GATE_COOKIE,
  SITE_GATE_SESSION_PARAM,
  cleanSiteGateSessionPath,
  siteGateAuthorized,
  siteGateConfig,
  siteGateSessionAuthorized,
  siteGateToken,
} from './lib/server/site-password-gate'

const PUBLIC_GATE_PATHS = new Set(['/unlock', '/api/site-unlock'])

function protectedHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_GATE_PATHS.has(pathname)) return protectedHeaders(NextResponse.next())

  const gate = siteGateConfig(process.env)
  if (!gate.enabled || !gate.accessCode || !gate.gateKey) {
    return new NextResponse('Site access is temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

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

  const unlockUrl = new URL('/unlock', request.url)
  const cleanNext = request.nextUrl.clone()
  cleanNext.searchParams.delete(SITE_GATE_SESSION_PARAM)
  unlockUrl.searchParams.set('next', `${cleanNext.pathname}${cleanNext.search}`)
  return protectedHeaders(NextResponse.redirect(unlockUrl, 307))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
