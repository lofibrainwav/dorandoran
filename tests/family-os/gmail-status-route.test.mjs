import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'

import { HOUSEHOLD_SESSION_COOKIE, householdSessionToken } from '../../lib/server/google-household-session.ts'
import { GET as gmailStatusRoute } from '../../app/api/chat/gmail/status/route.ts'

const ORIGIN = 'http://localhost:3000'
const AUTH_SECRET = 'gmail-status-test-secret'
const MEMBER = { personId: 'jay', googleSub: 'sub-jay', access: 'adult', roles: ['admin'] }

process.env.NODE_ENV = 'test'
process.env.DORANDORAN_AUTH_SECRET = AUTH_SECRET
process.env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON = JSON.stringify([MEMBER])

async function request(withCookie = true) {
  const headers = { origin: ORIGIN }
  if (withCookie) {
    const token = await householdSessionToken(MEMBER.googleSub, AUTH_SECRET, Date.now() + 60_000)
    headers.cookie = `${HOUSEHOLD_SESSION_COOKIE}=${token}`
  }
  return new NextRequest(`${ORIGIN}/api/chat/gmail/status`, { headers })
}

function clearGmailEnv() {
  delete process.env.GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID
  delete process.env.GOOGLE_HOUSEHOLD_GMAIL_CLIENT_SECRET
  delete process.env.GOOGLE_HOUSEHOLD_GMAIL_REFRESH_TOKEN
}

test.beforeEach(clearGmailEnv)
test.after(clearGmailEnv)

test('Gmail status requires an authenticated household session', async () => {
  const response = await gmailStatusRoute(await request(false))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' })
})

test('Gmail status reports not_connected without reading Inbox', async () => {
  const response = await gmailStatusRoute(await request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'not_connected', readOnly: true })
})

test('Gmail status reports incomplete when only part of the dedicated config exists', async () => {
  process.env.GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID = 'client'
  const response = await gmailStatusRoute(await request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { status: 'incomplete', readOnly: true })
})
