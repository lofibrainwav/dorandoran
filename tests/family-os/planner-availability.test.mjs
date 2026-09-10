import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as domain from '../../lib/family-os/index.ts'
import * as planner from '../../lib/family-os/family-planner.ts'
import * as session from '../../lib/server/google-household-session.ts'

const compiled = ts.transpileModule(readFileSync(new URL('../../app/api/planner/availability/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

test('availability authenticates before provider reads and remains private and fail-closed', async () => {
  const members = [{ personId: 'child', access: 'child', googleSub: 'child', canSignIn: false }, { personId: 'adult', googleSub: 'adult', canSignIn: true }]
  const prior = process.env.DORANDORAN_AUTH_SECRET
  process.env.DORANDORAN_AUTH_SECRET = 'availability-test-only-secret'
  let reads = 0
  let fail = false
  const dependencies = {
    '@/lib/family-os': { ...domain, parseHouseholdMembership: () => members },
    '@/lib/family-os/family-planner': planner,
    '@/lib/server/google-household-session': session,
    '@/lib/server/private-family-surface': { privateFamilySurfaceEnabled: () => false },
    '@/lib/server/private-calendar-operating-source': { loadPrivateCalendarOperatingPerson: () => { throw new Error('Forbidden local read') } },
    '@/lib/server/private-operational-family-calendar-source': { loadPrivateOperationalFamilyCalendarPerson: async () => {
      reads += 1
      if (fail) throw new Error('private-provider-detail')
      return { householdObservations: [], sourceHealth: 'green' }
    } },
    '@/lib/server/schedule-result-selection': { selectScheduleResult: (operational) => operational },
  }
  const routeModule = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unknown dependency ${name}`)
    return dependencies[name]
  }, routeModule, routeModule.exports)
  const request = (token) => ({ cookies: { get: () => token ? { value: token } : undefined } })
  try {
    assert.equal((await routeModule.exports.GET(request())).status, 401)
    assert.equal(reads, 0)
    const token = await session.householdSessionToken('adult', process.env.DORANDORAN_AUTH_SECRET, Date.now() + 60000)
    const response = await routeModule.exports.GET(request(token))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    assert.equal((await response.json()).known, true)
    assert.equal(reads, 1)
    fail = true
    const unavailable = await routeModule.exports.GET(request(token))
    assert.equal(unavailable.status, 503)
    assert.deepEqual(await unavailable.json(), { error: 'CALENDAR_UNAVAILABLE' })
  } finally {
    if (prior === undefined) delete process.env.DORANDORAN_AUTH_SECRET
    else process.env.DORANDORAN_AUTH_SECRET = prior
  }
})

test('availability follows configured child identity and display name for both calendar sources', async () => {
  const members = [{ personId: 'jayden-custom', displayName: '기본 제이든', access: 'child', googleSub: 'child', canSignIn: false }, { personId: 'adult', googleSub: 'adult', canSignIn: true }]
  const prior = process.env.DORANDORAN_AUTH_SECRET
  const priorNames = process.env.DORANDORAN_HOUSEHOLD_DISPLAY_NAMES_JSON
  process.env.DORANDORAN_AUTH_SECRET = 'availability-config-test-secret'
  process.env.DORANDORAN_HOUSEHOLD_DISPLAY_NAMES_JSON = JSON.stringify({ 'jayden-custom': '제이든' })
  const calls = []
  const dependencies = {
    '@/lib/family-os': { ...domain, parseHouseholdMembership: () => members },
    '@/lib/family-os/family-planner': { ...planner, buildFamilyPlanner: (input) => { calls.push(input); return { known: input.known, childPersonId: input.childPersonId } } },
    '@/lib/server/google-household-session': session,
    '@/lib/server/private-family-surface': { privateFamilySurfaceEnabled: () => true },
    '@/lib/server/private-calendar-operating-source': { loadPrivateCalendarOperatingPerson: async (input) => { calls.push(input); return null } },
    '@/lib/server/private-operational-family-calendar-source': { loadPrivateOperationalFamilyCalendarPerson: async (input) => { calls.push(input); return null } },
    '@/lib/server/schedule-result-selection': { selectScheduleResult: () => null },
  }
  const routeModule = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unknown dependency ${name}`)
    return dependencies[name]
  }, routeModule, routeModule.exports)
  try {
    const token = await session.householdSessionToken('adult', process.env.DORANDORAN_AUTH_SECRET, Date.now() + 60000)
    const response = await routeModule.exports.GET({ cookies: { get: () => ({ value: token }) } })
    assert.equal(response.status, 200)
    assert.deepEqual(calls.slice(0, 2).map((input) => ({ personId: input.personId, label: input.label })), [
      { personId: 'jayden-custom', label: '제이든' },
      { personId: 'jayden-custom', label: '제이든' },
    ])
    assert.equal(calls.at(-1).childPersonId, 'jayden-custom')
  } finally {
    if (prior === undefined) delete process.env.DORANDORAN_AUTH_SECRET
    else process.env.DORANDORAN_AUTH_SECRET = prior
    if (priorNames === undefined) delete process.env.DORANDORAN_HOUSEHOLD_DISPLAY_NAMES_JSON
    else process.env.DORANDORAN_HOUSEHOLD_DISPLAY_NAMES_JSON = priorNames
  }
})
