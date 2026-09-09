import type { NextRequest } from 'next/server'
import { resolveLifecycleContext } from '../../../../lib/server/lifecycle-runtime.ts'
import { parseLimitParam, parseWorkStatesParam } from '../../../../lib/server/lifecycle-request.ts'
import { lifecycleErrorToHttp } from '../../../../lib/server/lifecycle-service.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** `?scope=family` returns the family-wide projection (boundary ③, one lane at a time can never
 * leak `personal`/`professional`). Any other value — or its absence — is a lane read for `?person`
 * (default: the viewer's own lane), scoped by the same read-authorization boundary as elsewhere. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) {
    return Response.json(
      { error: context.error },
      { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers },
    )
  }

  const { searchParams } = request.nextUrl
  const limit = parseLimitParam(searchParams.get('limit'))

  try {
    if (searchParams.get('scope') === 'family') {
      const tasks = await context.service.listFamilyTasks(context.viewer, { limit })
      return Response.json({ tasks }, { status: 200, headers })
    }

    const workStates = parseWorkStatesParam(searchParams.get('workState'))
    if (workStates === null) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })

    const personId = searchParams.get('person') ?? undefined
    const tasks = await context.service.listTasks(context.viewer, { personId, workStates, limit })
    return Response.json({ tasks }, { status: 200, headers })
  } catch (error) {
    const { status, code } = lifecycleErrorToHttp(error)
    return Response.json({ error: code }, { status, headers })
  }
}
