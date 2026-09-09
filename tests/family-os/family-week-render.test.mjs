import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import * as domain from '../../lib/family-os/index.ts'
import * as plannerDomain from '../../lib/family-os/family-planner.ts'
import { loadPrivateOperationalFamilyCalendarPerson } from '../../lib/server/private-operational-family-calendar-source.ts'
import { selectScheduleResult } from '../../lib/server/schedule-result-selection.ts'

const require = createRequire(import.meta.url)
// Compile the real server page, replacing only framework and external source boundaries.
// The real Calendar adapter, person projection, week projection and JSX all run here.
const compiled = ts.transpileModule(readFileSync(new URL('../../app/family/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText

const plannerCompiled = ts.transpileModule(readFileSync(new URL('../../components/family-planner.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const plannerModule = { exports: {} }
new Function('require', 'module', 'exports', plannerCompiled)((specifier) => {
  if (specifier === '@/lib/family-os/family-planner') return plannerDomain
  if (specifier === './family-globe') return { FamilyGlobe: () => createElement('div', { 'aria-label': 'map fixture' }) }
  if (specifier === 'react' || specifier === 'react/jsx-runtime') return require(specifier)
  throw new Error(`Unmocked planner boundary: ${specifier}`)
}, plannerModule, plannerModule.exports)

async function renderWeek(mode = 'populated', { exposeChildren = false } = {}) {
  const timeZone = 'America/Los_Angeles'
  const date = domain.weekWindowFromLocalDate(new Date(), timeZone).weekStartDate
  const env = {
    GOOGLE_CALENDAR_CLIENT_SECRET_PATH: '/private/render-fixture-client.json',
    GOOGLE_CALENDAR_TOKEN_PATH: '/private/render-fixture-token.json',
    DORANDORAN_FAMILY_CALENDAR_ID: 'private-render-fixture-calendar',
    DORANDORAN_CALENDAR_SUBJECT_RULES_JSON: JSON.stringify([
      { kind: 'event', sourceId: 'child-event', personId: 'child-a' },
      { kind: 'event', sourceId: 'adult-event', personId: 'private-adult-person-id' },
    ]),
  }
  const nextDate = new Date(`${date}T00:00:00Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const events = [
    { id: 'child-event', summary: 'Child practice', start: { dateTime: `${date}T12:00:00-07:00` }, end: { dateTime: `${date}T13:00:00-07:00` } },
    { id: 'adult-event', summary: 'Adult appointment', start: { dateTime: `${date}T14:00:00-07:00` }, end: { dateTime: `${date}T15:00:00-07:00` } },
    { id: 'all-day-event', summary: 'Shared reminder', description: 'private-provider-description', start: { date }, end: { date: nextDate.toISOString().slice(0, 10) } },
  ]
  const dependencies = {
    // `FamilyPlanner` only renders its `children` behind the client-side "더 보기" toggle
    // (`showContext`, `false` on first paint), so a plain static render of the real component can
    // never show lifecycle-lane content either — exactly like `FamilyOperatingHero` today. To
    // assert the *wiring* (page.tsx passes the right element into `children`) rather than the
    // toggle's own visibility behavior, `exposeChildren` swaps in a stub that renders `children`
    // unconditionally. The default (real component) path is untouched for every existing test.
    '@/components/family-planner': exposeChildren
      ? { FamilyPlanner: ({ children }) => createElement('div', { 'data-children-exposed': 'true' }, children) }
      : plannerModule.exports,
    '@/lib/family-os/family-planner': plannerDomain,
    'next/link': ({ children }) => createElement('a', null, children),
    '@/components/family-operating-hero': { FamilyOperatingHero: ({ person }) => {
      assert.doesNotMatch(JSON.stringify(person), /Adult appointment|Shared reminder/)
      return createElement('div', null, 'Person hero')
    } },
    '@/lib/family-os': {
      ...domain,
      parseHouseholdMembership: () => [{ personId: 'child-a', access: 'child' }],
      resolveHouseholdTimeZone: () => timeZone,
      resolveHouseholdHome: () => domain.resolveHouseholdHome({}),
    },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/server/google-household-session': {
      HOUSEHOLD_SESSION_COOKIE: 'dorandoran_household_v1',
      resolveHouseholdSessionMember: async () =>
        mode === 'no-lifecycle-viewer' ? null : { personId: 'child-a', access: 'child', googleSub: 'sub-child-a', roles: ['child'], canSignIn: false },
    },
    '@/components/lifecycle-lane': {
      LifecycleLane: ({ viewer, members }) =>
        createElement('div', { 'data-lifecycle-lane': viewer.personId, 'data-lifecycle-lane-members': members.length }, 'lane fixture'),
    },
    '@/lib/server/private-family-surface': { privateFamilySurfaceEnabled: () => false },
    '@/lib/server/private-calendar-operating-source': { loadPrivateCalendarOperatingPerson: () => { throw new Error('Local private source must remain disabled') } },
    '@/lib/server/private-calendar-temporal-source': { loadPrivateCalendarTemporalGrids: () => { throw new Error('Local private source must remain disabled') } },
    '@/lib/server/private-photo-snapshot': { loadPrivatePhotoSnapshot: () => { throw new Error('Local private source must remain disabled') } },
    '@/lib/server/private-photo-setup-guidance': { projectPrivatePhotoSetupGuidance: () => null },
    '@/lib/server/jdk-bridge-transport': { loadJaydenLearningModule: async () => ({ id: 'learning', label: 'Learning', state: 'blocked' }) },
    '@/lib/server/jdk-approved-releases': {
      loadJdkApprovedReleases: async () => ({ probe: 'not_configured', releases: [] }),
      projectLearningModuleWithApprovedReleases: (module) => module,
    },
    '@/lib/server/schedule-result-selection': { selectScheduleResult },
    '@/lib/server/private-operational-family-calendar-source': {
      loadPrivateOperationalFamilyCalendarPerson: async (input) => mode === 'unconfigured' ? null : loadPrivateOperationalFamilyCalendarPerson({
        ...input, env,
        readEvents: async () => {
          if (mode === 'failure') throw new Error('offline')
          return mode === 'empty' ? [] : events
        },
      }),
    },
  }
  const pageModule = { exports: {} }
  const pageRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
    if (specifier === 'react/jsx-runtime') return require(specifier)
    throw new Error(`Unmocked page boundary: ${specifier}`)
  }
  new Function('require', 'module', 'exports', compiled)(pageRequire, pageModule, pageModule.exports)
  return renderToStaticMarkup(await pageModule.exports.default())
}

test('the real Family Week page renders every household fact and the all-day/subject labels', async () => {
  const html = await renderWeek()
  for (const text of ['Child practice', 'Adult appointment', 'Shared reminder', '종일', 'Jayden', '보호자', '3개 실제 일정', '빈 시간에 자동 배치']) {
    assert.ok(html.includes(text), `Missing visible content: ${text}`)
  }
  for (const privateValue of ['private-adult-person-id', 'private-render-fixture-calendar', 'private-provider-description', '/private/', 'calendar:']) {
    assert.equal(html.includes(privateValue), false, `Private field leaked: ${privateValue}`)
  }
})

test('the page wires the A4 lifecycle lane section into FamilyPlanner children for a resolved viewer', async () => {
  const html = await renderWeek('populated', { exposeChildren: true })
  assert.ok(html.includes('CAPTURE'))
  assert.ok(html.includes('사람이 수락한 것만 할 일이 됩니다.'))
  assert.ok(html.includes('data-lifecycle-lane="child-a"'), 'LifecycleLane did not receive the resolved viewer')
  assert.ok(html.includes('data-lifecycle-lane-members="1"'), 'LifecycleLane did not receive the household membership')
})

test('the page renders no lifecycle lane section when there is no resolved household session', async () => {
  const html = await renderWeek('no-lifecycle-viewer', { exposeChildren: true })
  assert.equal(html.includes('data-lifecycle-lane'), false)
})

test('the real (unexposed) page still renders successfully with a resolved viewer wired in', async () => {
  // Confirms the new imports/session-resolution wiring do not break the real, default-collapsed
  // render — lifecycle-lane content is legitimately absent here (same as FamilyOperatingHero)
  // because `showContext` starts `false`.
  const html = await renderWeek()
  assert.ok(html.includes('빈 시간에 자동 배치'))
  assert.equal(html.includes('data-lifecycle-lane'), false)
})

test('the rendered week distinguishes failed/unconfigured sources from an observed empty week', async () => {
  for (const mode of ['failure', 'unconfigured']) {
    const html = await renderWeek(mode)
    assert.match(html, /일정이 확인되지 않아 빈 시간으로 간주하지 않습니다/)
    assert.doesNotMatch(html, /분의 여유/)
  }
  const empty = await renderWeek('empty')
  assert.match(empty, /분의 여유/)
  assert.match(empty, /0개 실제 일정/)
})
