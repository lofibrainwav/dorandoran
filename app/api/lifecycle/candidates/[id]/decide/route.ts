import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '../../../../../../lib/server/lifecycle-runtime.ts'
import { parseDecideBody } from '../../../../../../lib/server/lifecycle-request.ts'
import { lifecycleErrorToHttp } from '../../../../../../lib/server/lifecycle-service.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Records the one and only human decision a Candidate ever gets. `by` is always the viewer's own
 * personId — never taken from the body — so this endpoint can never be used to forge someone
 * else's decision even by an actor otherwise allowed to decide for that lane. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })

  const context = await resolveLifecycleContext(request)
  if ('error' in context) {
    return Response.json(
      { error: context.error },
      { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })
  }
  const input = parseDecideBody(body)
  if (!input) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })

  const { id: candidateId } = await params

  try {
    const result = await context.service.decideCandidate(context.viewer, { candidateId, ...input })
    return Response.json(result, { status: 200, headers })
  } catch (error) {
    const { status, code } = lifecycleErrorToHttp(error)
    return Response.json({ error: code }, { status, headers })
  }
}
