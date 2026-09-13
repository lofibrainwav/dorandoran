import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

import * as identity from '../../lib/family-os/google-household-identity.ts'
import * as ports from '../../lib/server/opencli-research-ports.ts'
import { HOUSEHOLD_SESSION_COOKIE, householdSessionToken } from '../../lib/server/google-household-session.ts'
import * as session from '../../lib/server/google-household-session.ts'

const compiled = ts.transpileModule(readFileSync(new URL('../../app/api/research/observe/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

const routeModule = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  const dependencies = {
    '@/lib/family-os/google-household-identity': identity,
    '@/lib/server/opencli-research-ports': ports,
    '@/lib/server/google-household-session': session,
  }
  assert.ok(Object.hasOwn(dependencies, name), `Unknown dependency ${name}`)
  return dependencies[name]
}, routeModule, routeModule.exports)

const ORIGIN = 'http://localhost:3000'
const AUTH_SECRET = 'research-observe-test-secret'
const MEMBERSHIP = [{ personId: 'adult', googleSub: 'sub-adult', access: 'adult', roles: ['admin'] }]

process.env.DORANDORAN_AUTH_SECRET = AUTH_SECRET
process.env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON = JSON.stringify(MEMBERSHIP)

async function request({ url = '', withCookie = true } = {}) {
  const headers = {}
  if (withCookie) {
    const token = await householdSessionToken('sub-adult', AUTH_SECRET, Date.now() + 60_000)
    headers.cookie = `${HOUSEHOLD_SESSION_COOKIE}=${token}`
  }
  return {
    cookies: { get: (name) => name === HOUSEHOLD_SESSION_COOKIE ? { value: headers.cookie?.split('=').slice(1).join('=') } : undefined },
    nextUrl: new URL(`${ORIGIN}/api/research/observe${url}`),
  }
}

test('research observation requires an authenticated household session', async () => {
  const response = await routeModule.exports.GET(await request({ withCookie: false }))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' })
})

test('research observation rejects a missing URL before OpenCLI runs', async () => {
  const response = await routeModule.exports.GET(await request())
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'RESEARCH_URL_REQUIRED' })
})

test('research observation rejects non-web URLs without exposing command details', async () => {
  const response = await routeModule.exports.GET(await request({ url: '?url=file%3A%2F%2F%2Ftmp%2Fsecret' }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'RESEARCH_URL_INVALID' })
})
