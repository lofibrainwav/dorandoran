import type { NextRequest } from 'next/server'
import { assertSameOrigin, resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { generateDoranChatReply, resolveDoranChatAiConfig } from '@/lib/server/doran-chat-ai'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

function requestValues(value: unknown): { message: string; context: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as { message?: unknown; context?: unknown }
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) return null
  if (typeof body.context !== 'string' || body.context.length > 6000) return null
  return { message: body.message, context: body.context }
}

/** Read-only AI chat. It has no lifecycle, Drive, Gmail, Calendar, or external-write tools. */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403, headers })
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })

  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers }) }
  const values = requestValues(body)
  if (!values) return Response.json({ error: 'BODY_INVALID' }, { status: 400, headers })

  try {
    const config = resolveDoranChatAiConfig(process.env)
    if (!config) return Response.json({ mode: 'fallback', reason: 'AI_NOT_CONFIGURED' }, { status: 200, headers })
    const reply = await generateDoranChatReply({ config, message: values.message, context: { summary: values.context } })
    return Response.json({ mode: 'ai', reply }, { status: 200, headers })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DORAN_CHAT_AI_UNAVAILABLE'
    const safeCode = code.startsWith('DORAN_CHAT_AI_') ? code : 'DORAN_CHAT_AI_UNAVAILABLE'
    return Response.json({ mode: 'fallback', reason: safeCode }, { status: 200, headers })
  }
}
