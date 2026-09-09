import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '../../../../../lib/server/lifecycle-runtime.ts'
import { parseTransitionBody } from '../../../../../lib/server/lifecycle-request.ts'
import { lifecycleErrorToHttp } from '../../../../../lib/server/lifecycle-service.ts'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Transitions a Task's work state. A3 mints no chad executor, so this is always a human-driven
 * transition — a `done` transition still requires readback evidence, enforced by A1. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const input = parseTransitionBody(body)
  if (!input) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })

  const { id: taskId } = await params

  try {
    const result = await context.service.transitionTask(context.viewer, { taskId, ...input })
    return Response.json(result, { status: 200, headers })
  } catch (error) {
    const { status, code } = lifecycleErrorToHttp(error)
    return Response.json({ error: code }, { status, headers })
  }
}
