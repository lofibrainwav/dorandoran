import { authenticate } from '@google-cloud/local-auth'
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'

const scope = 'https://www.googleapis.com/auth/calendar.readonly'
const clientPath = process.env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH
const tokenPath = process.env.GOOGLE_CALENDAR_TOKEN_PATH

if (!clientPath || !tokenPath) {
  throw new Error('GOOGLE_CALENDAR_LOCAL_AUTH_ENV_MISSING')
}

const rawClient = JSON.parse(await readFile(clientPath, 'utf8'))
const clientMeta = rawClient.installed ?? rawClient.web
if (!clientMeta?.client_id || !clientMeta?.client_secret) {
  throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
}

console.log('Opening Google authorization for Calendar read-only access...')
const auth = await authenticate({ keyfilePath: clientPath, scopes: [scope] })
const credentials = auth.credentials

if (!credentials?.access_token && !credentials?.refresh_token) {
  throw new Error('GOOGLE_CALENDAR_AUTH_RETURNED_NO_CREDENTIALS')
}
await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 })

const tokenRecord = {
  version: 1,
  scope,
  createdAt: new Date().toISOString(),
  clientId: clientMeta.client_id,
  credentials,
}

await writeFile(tokenPath, `${JSON.stringify(tokenRecord, null, 2)}\n`, {
  mode: 0o600,
})
await chmod(tokenPath, 0o600)

console.log('AUTH_OK')
console.log(`TOKEN_PATH=${tokenPath}`)
console.log(`REFRESH_TOKEN=${credentials.refresh_token ? 'present' : 'missing'}`)
console.log('No calendar event contents were read by this step.')
