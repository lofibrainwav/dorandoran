import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '../../../../lib/server/lifecycle-runtime.ts'
import { parseCaptureBody } from '../../../../lib/server/lifecycle-request.ts'
import { lifecycleErrorToHttp } from '../../../../lib/server/lifecycle-service.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Records a Capture (and optionally proposes a Candidate from it) into the viewer's own lane, or
 * — adult only — a child's lane. Never mutates anything outside this app's own store. */
export async function POST(request: NextRequest) {
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
  const input = parseCaptureBody(body)
  if (!input) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })

  try {
    const result = await context.service.capture(context.viewer, input)
    return Response.json(result, { status: 201, headers })
  } catch (error) {
    const { status, code } = lifecycleErrorToHttp(error)
    return Response.json({ error: code }, { status, headers })
  }
}
