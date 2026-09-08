import { NextResponse, type NextRequest } from 'next/server'
import {
  SITE_GATE_COOKIE,
  safeNextPath,
  siteGateConfig,
  siteGateToken,
} from '@/lib/server/site-password-gate'

function unlockRedirect(request: NextRequest, next: string, error = false) {
  const url = new URL('/unlock', request.url)
  url.searchParams.set('next', next)
  if (error) url.searchParams.set('error', '1')
  return NextResponse.redirect(url, 303)
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

  const response = NextResponse.redirect(new URL(next, request.url), 303)
  response.cookies.set(SITE_GATE_COOKIE, await siteGateToken(gate.accessCode, gate.gateKey), {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
