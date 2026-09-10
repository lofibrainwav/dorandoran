import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateDoranChatReply,
  resolveDoranChatAiConfig,
} from '../../lib/server/doran-chat-ai.ts'

test('AI chat is off when no provider settings exist', () => {
  assert.equal(resolveDoranChatAiConfig({}), null)
})

test('AI chat refuses partial or non-http configuration', () => {
  assert.throws(() => resolveDoranChatAiConfig({ DORAN_CHAT_API_URL: 'https://example.test', DORAN_CHAT_MODEL: 'demo' }), /DORAN_CHAT_AI_CONFIG_INCOMPLETE/)
  assert.throws(() => resolveDoranChatAiConfig({ DORAN_CHAT_API_URL: 'http://example.test', DORAN_CHAT_API_KEY: 'key', DORAN_CHAT_MODEL: 'demo' }), /DORAN_CHAT_AI_ENDPOINT_INVALID/)
  assert.throws(() => resolveDoranChatAiConfig({ DORAN_CHAT_API_URL: 'file:///tmp/provider', DORAN_CHAT_API_KEY: 'key', DORAN_CHAT_MODEL: 'demo' }), /DORAN_CHAT_AI_ENDPOINT_INVALID/)
})

test('AI chat sends bounded read-only context and returns only assistant content', async () => {
  const config = resolveDoranChatAiConfig({
    DORAN_CHAT_API_URL: 'https://example.test/v1/chat/completions',
    DORAN_CHAT_API_KEY: 'secret-value',
    DORAN_CHAT_MODEL: 'family-model',
  })
  assert.ok(config)
  let request
  const reply = await generateDoranChatReply({
    config,
    message: '이번 주 다음 일정은?',
    context: { summary: '오늘 일정 수: 2\n내부 토큰은 전송하지 않음' },
    fetcher: async (url, init) => {
      request = { url, init }
      return new Response(JSON.stringify({ choices: [{ message: { content: '확인된 다음 일정은 수영입니다.' } }] }), { status: 200 })
    },
  })
  assert.equal(reply, '확인된 다음 일정은 수영입니다.')
  assert.equal(request.url, config.endpoint)
  assert.equal(request.init.method, 'POST')
  const body = JSON.parse(request.init.body)
  assert.equal(body.model, 'family-model')
  assert.equal(body.tools, undefined)
  assert.match(body.messages[1].content, /이번 주 다음 일정은/)
  assert.match(request.init.headers.Authorization, /^Bearer /)
})

test('empty provider content fails closed', async () => {
  const config = resolveDoranChatAiConfig({
    DORAN_CHAT_API_URL: 'https://example.test/chat',
    DORAN_CHAT_API_KEY: 'secret-value',
    DORAN_CHAT_MODEL: 'family-model',
  })
  await assert.rejects(
    () => generateDoranChatReply({ config, message: '안녕', context: { summary: '' }, fetcher: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }) }),
    /DORAN_CHAT_AI_EMPTY_RESPONSE/,
  )
})
