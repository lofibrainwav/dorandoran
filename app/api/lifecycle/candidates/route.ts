import type { NextRequest } from 'next/server'
import { resolveLifecycleContext } from '../../../../lib/server/lifecycle-runtime.ts'
import { parseLimitParam } from '../../../../lib/server/lifecycle-request.ts'
import { lifecycleErrorToHttp } from '../../../../lib/server/lifecycle-service.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Lists Candidates for `?person=` (default: the viewer's own lane), scoped by the same
 * read-authorization boundary as every other lifecycle read. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) {
    return Response.json(
      { error: context.error },
      { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers },
    )
  }

  const { searchParams } = request.nextUrl
  const personId = searchParams.get('person') ?? undefined
  const limit = parseLimitParam(searchParams.get('limit'))

  try {
    const candidates = await context.service.listCandidates(context.viewer, { personId, limit })
    return Response.json({ candidates }, { status: 200, headers })
  } catch (error) {
    const { status, code } = lifecycleErrorToHttp(error)
    return Response.json({ error: code }, { status, headers })
  }
}
