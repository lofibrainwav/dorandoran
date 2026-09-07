import { readFile } from 'node:fs/promises'
import { google } from 'googleapis'
import {
  assertGoogleTokenServices,
  normalizePrivateGmailMessage,
  planBoundedGmailRead,
} from '../lib/family-os/index.ts'

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
const sourceKey = sourceArg?.split('=')[1]?.trim().toLowerCase()
const queryArg = process.argv.find((arg) => arg.startsWith('--query='))
const maxArg = process.argv.find((arg) => arg.startsWith('--max-results='))
if (!sourceKey) throw new Error('GMAIL_SOURCE_REQUIRED')

const key = sourceKey.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
const prefix = `GOOGLE_CALENDAR_SOURCE_${key}`
const clientPath = process.env[`${prefix}_CLIENT_SECRET_PATH`]
const tokenPath = process.env[`${prefix}_TOKEN_PATH`]
if (!clientPath || !tokenPath) throw new Error('GMAIL_LOCAL_SOURCE_ENV_MISSING')

const plan = planBoundedGmailRead({
  query: queryArg?.slice('--query='.length) ?? '',
  maxResults: Number(maxArg?.slice('--max-results='.length)),
})
const rawClient = JSON.parse(await readFile(clientPath, 'utf8'))
const clientMeta = rawClient.installed ?? rawClient.web
const tokenRecord = JSON.parse(await readFile(tokenPath, 'utf8'))
if (!clientMeta?.client_id || !clientMeta?.client_secret) {
  throw new Error('INVALID_GOOGLE_GMAIL_CLIENT_FILE')
}
if (tokenRecord.clientId !== clientMeta.client_id) {
  throw new Error('GOOGLE_GMAIL_TOKEN_CLIENT_MISMATCH')
}
assertGoogleTokenServices(tokenRecord, ['gmail'])

const auth = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
auth.setCredentials(tokenRecord.credentials)
const gmail = google.gmail({ version: 'v1', auth })
const list = await gmail.users.messages.list({
  userId: 'me',
  q: plan.query,
  maxResults: plan.maxResults,
})
const refs = list.data.messages ?? []
let normalizedCount = 0
let invalidCount = 0
const observedAt = new Date().toISOString()
for (const ref of refs) {
  if (!ref.id) continue
  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: ref.id,
      format: 'full',
    })
    normalizePrivateGmailMessage({
      accountId: sourceKey,
      raw: message.data,
      observedAt,
    })
    normalizedCount += 1
  } catch {
    invalidCount += 1
  }
}

if (invalidCount > 0 || normalizedCount !== refs.length) {
  throw new Error('GOOGLE_GMAIL_LIVE_SMOKE_FAILED')
}
console.log('GMAIL_LIVE_READ_OK')
console.log(`MESSAGE_COUNT=${refs.length}`)
console.log(`NORMALIZED_COUNT=${normalizedCount}`)
console.log('No subjects, senders, snippets, bodies, or message ids were printed.')
