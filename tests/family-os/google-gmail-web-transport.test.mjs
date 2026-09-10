import test from 'node:test'
import assert from 'node:assert/strict'
import {
  gmailWebRuntimeHealth,
  resolveGoogleGmailWebRuntimeConfig,
  verifyGoogleGmailWebCapability,
} from '../../lib/server/google-gmail-web-transport.ts'

test('Gmail web runtime is off when no dedicated credentials exist', () => {
  assert.equal(gmailWebRuntimeHealth({}), 'off')
  assert.equal(resolveGoogleGmailWebRuntimeConfig({}), null)
})

test('Gmail web runtime is incomplete until all dedicated credentials exist', () => {
  const env = { GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID: 'client' }
  assert.equal(gmailWebRuntimeHealth(env), 'incomplete')
  assert.throws(() => resolveGoogleGmailWebRuntimeConfig(env), /INCOMPLETE_GOOGLE_GMAIL_WEB_CONFIG/)
})

test('Gmail credentials are resolved from the dedicated read-only surface', () => {
  const env = {
    GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID: ' client ',
    GOOGLE_HOUSEHOLD_GMAIL_CLIENT_SECRET: ' secret ',
    GOOGLE_HOUSEHOLD_GMAIL_REFRESH_TOKEN: ' refresh ',
  }
  assert.deepEqual(resolveGoogleGmailWebRuntimeConfig(env), { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' })
})

test('Gmail capability verification accepts an observed profile without reading messages', async () => {
  await assert.doesNotReject(() => verifyGoogleGmailWebCapability(
    { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
    async () => 'family@example.invalid',
  ))
})

test('Gmail capability verification fails closed when the provider profile is unavailable', async () => {
  await assert.rejects(
    () => verifyGoogleGmailWebCapability(
      { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
      async () => undefined,
    ),
    /GMAIL_ACCOUNT_ID_UNOBSERVABLE/,
  )
})
