import { NextResponse, type NextRequest } from 'next/server'
import { parseHouseholdMembership } from '../../../../lib/family-os/google-household-identity.ts'
import {
  HOUSEHOLD_SESSION_COOKIE,
  HOUSEHOLD_SESSION_MAX_AGE_SECONDS,
  householdSessionToken,
} from '../../../../lib/server/google-household-session.ts'
import {
  buildGoogleRedirectBridgeHtml,
  verifyGoogleHouseholdCredential,
} from '../../../../lib/server/google-household-web-auth.ts'

function redirectToSignIn(request: NextRequest, error: 'csrf' | 'denied' | 'google') {
  const url = new URL('/signin', request.url)
  url.searchParams.set('error', error)
  return NextResponse.redirect(url, 303)
}

function sessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: HOUSEHOLD_SESSION_MAX_AGE_SECONDS,
  }
}

// GIS redirect mode may land here with GET + #id_token fragment; bridge it into the POST contract.
export async function GET() {
  return new NextResponse(buildGoogleRedirectBridgeHtml(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const credential = String(form.get('credential') ?? '').trim()
  const csrfForm = String(form.get('g_csrf_token') ?? '').trim()
  const csrfCookie = request.cookies.get('g_csrf_token')?.value?.trim() ?? ''

  if (!csrfForm || !csrfCookie || csrfForm !== csrfCookie) {
    return redirectToSignIn(request, 'csrf')
  }

  const clientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim()
  const authSecret = process.env.DORANDORAN_AUTH_SECRET?.trim()
  if (!clientId || !authSecret) {
    return new NextResponse('Google household access is temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  let membership
  try {
    membership = parseHouseholdMembership(process.env)
  } catch {
    return new NextResponse('Google household access is temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }
  if (!membership.length) {
    return new NextResponse('Google household access is temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  try {
    const authorized = await verifyGoogleHouseholdCredential({ credential, clientId, membership })
    if (!authorized) return redirectToSignIn(request, 'denied')

    const expiresAt = Date.now() + HOUSEHOLD_SESSION_MAX_AGE_SECONDS * 1000
    const token = await householdSessionToken(authorized.googleSub, authSecret, expiresAt)
    const response = NextResponse.redirect(new URL('/', request.url), 303)
    response.cookies.set(HOUSEHOLD_SESSION_COOKIE, token, sessionCookieOptions(request))
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  } catch {
    return redirectToSignIn(request, 'google')
  }
}
