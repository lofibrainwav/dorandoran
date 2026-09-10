export interface DoranChatAiConfig {
  endpoint: string
  apiKey: string
  model: string
}

export interface DoranChatContext {
  summary: string
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function resolveDoranChatAiConfig(
  env: Record<string, string | undefined>,
): DoranChatAiConfig | null {
  const endpoint = clean(env.DORAN_CHAT_API_URL)
  const apiKey = clean(env.DORAN_CHAT_API_KEY)
  const model = clean(env.DORAN_CHAT_MODEL)
  if (!endpoint && !apiKey && !model) return null
  if (!endpoint || !apiKey || !model) throw new Error('DORAN_CHAT_AI_CONFIG_INCOMPLETE')
  let parsed: URL
  try { parsed = new URL(endpoint) } catch { throw new Error('DORAN_CHAT_AI_ENDPOINT_INVALID') }
  if (parsed.protocol !== 'https:') throw new Error('DORAN_CHAT_AI_ENDPOINT_INVALID')
  return { endpoint: parsed.toString(), apiKey, model }
}

function safeContent(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('DORAN_CHAT_AI_EMPTY_RESPONSE')
  return value.trim().slice(0, 8000)
}

export async function generateDoranChatReply(input: {
  config: DoranChatAiConfig
  message: string
  context: DoranChatContext
  fetcher?: typeof fetch
}): Promise<string> {
  const message = input.message.trim().slice(0, 4000)
  if (!message) throw new Error('DORAN_CHAT_MESSAGE_REQUIRED')
  const context = input.context.summary.trim().slice(0, 6000)
  const fetcher = input.fetcher ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetcher(input.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.config.apiKey}`,
      },
      body: JSON.stringify({
        model: input.config.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: '당신은 도란도란 가족 운영판의 읽기 전용 대화 도우미입니다. 제공된 확인 정보만 사용하고 모르는 것은 모른다고 답하세요. 일정·파일·메일을 만들거나 수정하거나 발송했다고 말하지 마세요. Candidate 제안은 가능하지만 Task 확정은 반드시 사람의 승인 대상이라고 안내하세요. 내부 ID, 자격증명, 원문 비밀정보는 노출하지 마세요.',
          },
          { role: 'user', content: `확인된 가족 운영 요약:\n${context}\n\n질문:\n${message}` },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('DORAN_CHAT_AI_PROVIDER_FAILED')
    const payload = await response.json() as ChatCompletionResponse
    return safeContent(payload.choices?.[0]?.message?.content)
  } finally {
    clearTimeout(timeout)
  }
}
