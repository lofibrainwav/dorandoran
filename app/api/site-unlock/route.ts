import { NextResponse, type NextRequest } from 'next/server'
import {
  SITE_GATE_COOKIE,
  SITE_GATE_SESSION_MAX_AGE_SECONDS,
  SITE_GATE_SESSION_PARAM,
  safeNextPath,
  siteGateConfig,
  siteGateSessionToken,
  siteGateToken,
} from '@/lib/server/site-password-gate'

function unlockRedirect(request: NextRequest, next: string, error = false) {
  const url = new URL('/unlock', request.url)
  url.searchParams.set('next', next)
  if (error) url.searchParams.set('error', '1')
  const response = NextResponse.redirect(url, 303)
  response.headers.set('Cache-Control', 'no-store')
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

export async function POST(request: NextRequest) {
  const gate = siteGateConfig(process.env)
  if (!gate.enabled || !gate.accessCode || !gate.gateKey) {
    return new NextResponse('Site access is temporarily unavailable.', { status: 503 })
  }

  const form = await request.formData()
  const password = typeof form.get('password') === 'string' ? String(form.get('password')) : ''
  const next = safeNextPath(typeof form.get('next') === 'string' ? String(form.get('next')) : '/')
  if (password !== gate.accessCode) {
    await new Promise((resolve) => setTimeout(resolve, 900))
    return unlockRedirect(request, next, true)
  }

  const destination = new URL(next, request.url)
  destination.searchParams.set(
    SITE_GATE_SESSION_PARAM,
    await siteGateSessionToken(gate.gateKey, Date.now() + SITE_GATE_SESSION_MAX_AGE_SECONDS * 1000),
  )
  const response = NextResponse.redirect(destination, 303)
  response.cookies.set(
    SITE_GATE_COOKIE,
    await siteGateToken(gate.accessCode, gate.gateKey),
    cookieOptions(request),
  )
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
