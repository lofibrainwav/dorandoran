import { google } from 'googleapis'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises'
import { dirname } from 'node:path'
import { resolveGoogleReadOnlyScopes } from '../lib/family-os/google-source-scopes.ts'

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
const sourceKey = sourceArg?.split('=')[1]?.trim().toLowerCase()
const servicesArg = process.argv.find((arg) => arg.startsWith('--services='))
const services = (servicesArg?.split('=')[1] ?? 'calendar').split(',').map((value) => value.trim()).filter(Boolean)
const scopes = resolveGoogleReadOnlyScopes(services)
const browserArg = process.argv.find((arg) => arg.startsWith('--browser='))
const browser = browserArg?.split('=').slice(1).join('=').trim()

function sourceEnv(name) {
  if (!name) {
    return {
      clientPath: process.env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH,
      tokenPath: process.env.GOOGLE_CALENDAR_TOKEN_PATH,
    }
  }
  const key = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const prefix = `GOOGLE_CALENDAR_SOURCE_${key}`
  return {
    clientPath: process.env[`${prefix}_CLIENT_SECRET_PATH`],
    tokenPath: process.env[`${prefix}_TOKEN_PATH`],
  }
}

const { clientPath, tokenPath } = sourceEnv(sourceKey)
if (!clientPath || !tokenPath) {
  throw new Error('GOOGLE_CALENDAR_LOCAL_AUTH_ENV_MISSING')
}
const rawClient = JSON.parse(await readFile(clientPath, 'utf8'))
const clientMeta = rawClient.installed ?? rawClient.web
if (!clientMeta?.client_id || !clientMeta?.client_secret) {
  throw new Error('INVALID_GOOGLE_CALENDAR_CLIENT_FILE')
}

async function authenticateLocal() {
  const redirectPath = '/oauth2callback'
  const client = new google.auth.OAuth2(clientMeta.client_id, clientMeta.client_secret)
  return await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const callback = new URL(req.url ?? '/', 'http://localhost')
        if (callback.pathname !== redirectPath) return res.end('Invalid callback URL')
        if (callback.searchParams.has('error')) throw new Error('GOOGLE_AUTH_REJECTED')
        const code = callback.searchParams.get('code')
        if (!code) throw new Error('GOOGLE_AUTH_CODE_MISSING')
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('GOOGLE_AUTH_SERVER_ADDRESS_MISSING')
        const redirectUri = `http://localhost:${address.port}${redirectPath}`
        const { tokens } = await client.getToken({ code, redirect_uri: redirectUri })
        res.end('Authentication successful. You can close this tab.')
        resolve(tokens)
      } catch (error) {
        res.statusCode = 400
        res.end('Authentication failed. Return to the console.')
        reject(error)
      } finally {
        server.close()
      }
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('GOOGLE_AUTH_SERVER_ADDRESS_MISSING'))
      const redirectUri = `http://localhost:${address.port}${redirectPath}`
      const authorizeUrl = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes, redirect_uri: redirectUri })
      const args = browser ? ['-a', browser, authorizeUrl] : [authorizeUrl]
      spawn('open', args, { detached: true, stdio: 'ignore' }).unref()
      console.log(`AUTH_SERVER_READY port=${address.port}`)
    })
  })
}

console.log(`Opening Google authorization for read-only access: ${services.join(', ')}`)
const credentials = await authenticateLocal()
if (!credentials?.access_token && !credentials?.refresh_token) {
  throw new Error('GOOGLE_CALENDAR_AUTH_RETURNED_NO_CREDENTIALS')
}

await mkdir(dirname(tokenPath), { recursive: true, mode: 0o700 })
const tokenRecord = {
  version: 1,
  scopes,
  services,
  createdAt: new Date().toISOString(),
  clientId: clientMeta.client_id,
  credentials,
}

await writeFile(tokenPath, `${JSON.stringify(tokenRecord, null, 2)}\n`, { mode: 0o600 })
await chmod(tokenPath, 0o600)

console.log('AUTH_OK')
console.log(`SOURCE=${sourceKey ?? 'legacy'}`)
console.log(`REFRESH_TOKEN=${credentials.refresh_token ? 'present' : 'missing'}`)
console.log(`SERVICES=${services.join(',')}`)
console.log('No Calendar or Gmail contents were read by this authorization step.')