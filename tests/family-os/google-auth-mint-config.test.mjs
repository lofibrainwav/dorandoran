import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveGoogleAuthMintTarget } from '../../lib/server/google-auth-mint-config.ts'

test('Drive mint keeps the existing outbox environment contract', () => {
  assert.deepEqual(resolveGoogleAuthMintTarget(['drive']), {
    service: 'drive',
    clientIdEnv: 'DRIVE_OUTBOX_CLIENT_ID',
    clientSecretEnv: 'DRIVE_OUTBOX_CLIENT_SECRET',
    refreshTokenEnv: 'DRIVE_OUTBOX_REFRESH_TOKEN',
    defaultOut: '.env.drive-outbox',
  })
})

test('Gmail mint writes to the bounded Gmail environment contract', () => {
  assert.deepEqual(resolveGoogleAuthMintTarget(['gmail']), {
    service: 'gmail',
    clientIdEnv: 'GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_HOUSEHOLD_GMAIL_CLIENT_SECRET',
    refreshTokenEnv: 'GOOGLE_HOUSEHOLD_GMAIL_REFRESH_TOKEN',
    defaultOut: '.env.gmail',
  })
})

test('mixed or unsupported mint scopes fail closed', () => {
  assert.throws(() => resolveGoogleAuthMintTarget(['drive', 'gmail']), /GOOGLE_AUTH_MINT_ONE_SERVICE_REQUIRED/)
  assert.throws(() => resolveGoogleAuthMintTarget(['calendar']), /GOOGLE_AUTH_MINT_ONE_SERVICE_REQUIRED/)
  assert.throws(() => resolveGoogleAuthMintTarget([]), /GOOGLE_AUTH_MINT_ONE_SERVICE_REQUIRED/)
})
