import type { NextRequest } from 'next/server'
import { resolveLifecycleContext } from '../../../../lib/server/lifecycle-runtime.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Returns only the already-authorized viewer identity needed to hydrate the Family OS lane. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) {
    return Response.json(
      { error: context.error },
      { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers },
    )
  }
  return Response.json({ viewer: { personId: context.viewer.personId, access: context.viewer.access } }, { status: 200, headers })
}
