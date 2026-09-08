import { NextResponse, type NextRequest } from 'next/server'
import {
  SITE_GATE_COOKIE,
  siteGateAuthorized,
  siteGateConfig,
} from './lib/server/site-password-gate'

const PUBLIC_GATE_PATHS = new Set(['/unlock', '/api/site-unlock'])

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_GATE_PATHS.has(pathname)) return NextResponse.next()

  const gate = siteGateConfig(process.env)
  if (!gate.enabled || !gate.accessCode || !gate.gateKey) {
    return new NextResponse('Site access is temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  const cookie = request.cookies.get(SITE_GATE_COOKIE)?.value
  if (await siteGateAuthorized(cookie, gate.accessCode, gate.gateKey)) return NextResponse.next()

  const unlockUrl = new URL('/unlock', request.url)
  unlockUrl.searchParams.set('next', `${pathname}${search}`)
  const response = NextResponse.redirect(unlockUrl, 307)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
