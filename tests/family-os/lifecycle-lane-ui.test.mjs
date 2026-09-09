import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

import * as lifecycleDomain from '../../lib/family-os/lifecycle.ts'
import * as lifecycleUiMessagesModule from '../../lib/family-os/lifecycle-ui-messages.ts'
import * as lifecycleUiModule from '../../lib/family-os/lifecycle-ui.ts'
import {
  LIFECYCLE_ERROR_CODES,
  LIFECYCLE_ERROR_DEFAULT_MESSAGE,
  lifecycleErrorMessage,
} from '../../lib/family-os/lifecycle-ui-messages.ts'
import {
  READBACK_EVIDENCE_MAX_LENGTH,
  canDecideCandidate,
  capturePrivacyScopeOptions,
  readbackEvidenceRef,
  readbackNoteMaxLength,
  visibleLaneMembers,
} from '../../lib/family-os/lifecycle-ui.ts'

const require = createRequire(import.meta.url)

// `components/lifecycle-lane.tsx` uses JSX, which bare `node --test` cannot parse directly.
// Transpile it the same way `family-week-render.test.mjs` transpiles the real page/planner
// components, then load it through a tiny module shim so the *actual* presentational
// components (not a reimplementation) are what gets rendered and asserted on below. Framework
// and lib boundaries are satisfied with the real, already-ESM-imported modules — nothing here
// reimplements lifecycle-lane's own logic.
const compiled = ts.transpileModule(
  readFileSync(new URL('../../components/lifecycle-lane.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText

const lifecycleModule = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  (specifier) => {
    if (specifier === '@/lib/family-os/contracts') return {}
    if (specifier === '@/lib/family-os/lifecycle') return lifecycleDomain
    if (specifier === '@/lib/family-os/lifecycle-ui-messages') return lifecycleUiMessagesModule
    if (specifier === '@/lib/family-os/lifecycle-ui') return lifecycleUiModule
    if (specifier === 'react' || specifier === 'react/jsx-runtime') return require(specifier)
    throw new Error(`Unmocked lifecycle-lane boundary: ${specifier}`)
  },
  lifecycleModule,
  lifecycleModule.exports,
)

const { LifecycleErrorText, CandidateCard, FamilyTaskList } = lifecycleModule.exports

function render(element) {
  return renderToStaticMarkup(element)
}

function candidateFixture(overrides = {}) {
  return {
    id: 'candidate-1',
    personId: 'julie',
    privacyScope: 'family',
    version: 1,
    state: 'proposed',
    opportunity: { title: 'Plan the trip', mode: 'digital', estimatedMinutes: 30 },
    ...overrides,
  }
}

function taskFixture(overrides = {}) {
  return {
    id: 'task-1',
    personId: 'julie',
    privacyScope: 'family',
    workState: 'open',
    version: 1,
    block: { reality: { title: 'Book flights' }, people: { subjectIds: ['julie'] } },
    ...overrides,
  }
}

// ---- error code mapping (DOM-free) ----

test('every specified lifecycle error code maps to its own Korean message', () => {
  const expected = {
    LANE_MISMATCH: '이 lane에는 적을 수 없습니다',
    PRIVACY_SCOPE_DENIED: '이 범위는 허용되지 않습니다',
    BODY_INVALID: '입력을 확인해 주세요',
    AUTH_REQUIRED: '다시 로그인해 주세요',
    ORIGIN_DENIED: '요청 출처가 확인되지 않았습니다',
    VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었습니다 — 새로고침',
    LIFECYCLE_STORE_UNAVAILABLE: '저장소에 연결할 수 없습니다',
  }
  for (const [code, message] of Object.entries(expected)) {
    assert.deepEqual(lifecycleErrorMessage(code), { code, message })
  }
  assert.deepEqual(new Set(LIFECYCLE_ERROR_CODES), new Set(Object.keys(expected)))
})

test('an unrecognized code still gets a Korean message, never just the raw code', () => {
  const result = lifecycleErrorMessage('SOMETHING_NEW')
  assert.equal(result.message, LIFECYCLE_ERROR_DEFAULT_MESSAGE)
  assert.equal(result.code, 'SOMETHING_NEW')
})

// ---- rendering: no raw code appears without its Korean text ----

test('every error code renders with its Korean message beside it, never the code alone', () => {
  for (const code of [...LIFECYCLE_ERROR_CODES, 'UNKNOWN_CODE']) {
    const html = render(createElement(LifecycleErrorText, { code }))
    const { message } = lifecycleErrorMessage(code)
    assert.ok(html.includes(message), `missing Korean message for ${code}`)
    assert.ok(html.includes(`<small>${code}</small>`), `code ${code} not shown alongside its message`)
    // The code must not appear anywhere outside that paired <small> — i.e. never bare.
    const withoutPairedCode = html.replace(`<small>${code}</small>`, '')
    assert.equal(withoutPairedCode.includes(code), false, `raw code ${code} leaked outside its <small>`)
  }
})

// ---- lane visibility ----

test('child viewer sees only their own lane tab', () => {
  const members = [
    { personId: 'jayden', access: 'child', label: 'Jayden' },
    { personId: 'julie', access: 'adult', label: 'Julie' },
    { personId: 'jay', access: 'adult', label: 'Jay' },
  ]
  const lanes = visibleLaneMembers({ personId: 'jayden', access: 'child' }, members)
  assert.deepEqual(lanes.map((lane) => lane.personId), ['jayden'])
})

test('adult viewer sees their own lane first, then every other lane', () => {
  const members = [
    { personId: 'jayden', access: 'child', label: 'Jayden' },
    { personId: 'julie', access: 'adult', label: 'Julie' },
    { personId: 'jay', access: 'adult', label: 'Jay' },
  ]
  const lanes = visibleLaneMembers({ personId: 'julie', access: 'adult' }, members)
  assert.deepEqual(lanes.map((lane) => lane.personId), ['julie', 'jayden', 'jay'])
})

// ---- capture privacy-scope options ----

test('the capture scope select offers professional only for the viewer\'s own lane', () => {
  const own = capturePrivacyScopeOptions(true)
  const other = capturePrivacyScopeOptions(false)
  assert.deepEqual(own.map((option) => option.value), ['personal', 'family', 'professional'])
  assert.deepEqual(other.map((option) => option.value), ['personal', 'family'])
})

test('rendering the own-lane capture form includes the professional option; another lane does not', () => {
  // Exercises the same rendering path the component uses: a <select> built from
  // capturePrivacyScopeOptions. Rendered directly (rather than clicking a lane tab, which a
  // static server render cannot simulate) so this still runs through react-dom/server.
  function renderScopeSelect(isOwnLane) {
    const options = capturePrivacyScopeOptions(isOwnLane)
    return render(
      createElement(
        'select',
        { 'aria-label': '범위' },
        options.map((option) => createElement('option', { key: option.value, value: option.value }, option.label)),
      ),
    )
  }
  assert.ok(renderScopeSelect(true).includes('업무'))
  assert.ok(!renderScopeSelect(false).includes('업무'))
})

test('a child never sees the professional option, even in their own lane (mirrors validateCaptureWrite)', () => {
  const childOwn = capturePrivacyScopeOptions(true, 'child')
  assert.deepEqual(childOwn.map((option) => option.value), ['personal', 'family'])
  // The pure server rule this mirrors: a child session writing professional into its own lane is refused.
  const now = '2026-09-08T20:00:00.000Z'
  const result = lifecycleDomain.validateCaptureWrite({
    capture: {
      id: 'cap-child-professional', personId: 'jayden', privacyScope: 'professional', kind: 'want',
      statedText: 'client memo', source: 'human', occurredAt: now, capturedAt: now, capturedBy: 'jayden',
      evidenceRefs: [], unknowns: [],
    },
    session: { personId: 'jayden', access: 'child' },
    target: { personId: 'jayden', access: 'child' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.code, 'PRIVACY_SCOPE_DENIED')
})

// ---- done transition readback evidence ----

test('readback evidence never exceeds the server per-item bound, whatever the note length', () => {
  const taskId = '3f2b1c9e-6b8a-4d1e-9f0a-1234567890ab' // UUID-shaped, 36 chars
  const longNote = 'ㄱ'.repeat(500)
  const ref = readbackEvidenceRef(taskId, longNote)
  assert.ok(ref.startsWith(`human:readback:${taskId}:`))
  assert.ok(ref.length <= READBACK_EVIDENCE_MAX_LENGTH, `ref length ${ref.length}`)
  assert.equal(ref.length, READBACK_EVIDENCE_MAX_LENGTH)
  // The input maxLength the component exposes is the same budget the ref builder uses.
  assert.equal(readbackNoteMaxLength(taskId), READBACK_EVIDENCE_MAX_LENGTH - 'human:readback:'.length - taskId.length - 1)
  // A short note survives intact (trimmed only).
  assert.equal(readbackEvidenceRef(taskId, '  확인했어요  '), `human:readback:${taskId}:확인했어요`)
})

// ---- decide permission ----

test('canDecideCandidate: own lane and adult-over-child are allowed; adult-over-adult is not', () => {
  assert.equal(
    canDecideCandidate({ viewerPersonId: 'julie', viewerAccess: 'adult', targetPersonId: 'julie', targetAccess: 'adult' }),
    true,
  )
  assert.equal(
    canDecideCandidate({ viewerPersonId: 'julie', viewerAccess: 'adult', targetPersonId: 'jayden', targetAccess: 'child' }),
    true,
  )
  assert.equal(
    canDecideCandidate({ viewerPersonId: 'julie', viewerAccess: 'adult', targetPersonId: 'jay', targetAccess: 'adult' }),
    false,
  )
  assert.equal(
    canDecideCandidate({ viewerPersonId: 'jayden', viewerAccess: 'child', targetPersonId: 'julie', targetAccess: 'adult' }),
    false,
  )
})

test('CandidateCard hides decide buttons when an adult views another adult\'s lane', () => {
  const candidate = candidateFixture()
  const canDecide = canDecideCandidate({
    viewerPersonId: 'jay',
    viewerAccess: 'adult',
    targetPersonId: 'julie',
    targetAccess: 'adult',
  })
  assert.equal(canDecide, false)
  const html = render(
    createElement(CandidateCard, { candidate, canDecide, busy: false, onAccept: () => {}, onDecline: () => {} }),
  )
  assert.equal(html.includes('수락'), false)
  assert.equal(html.includes('거절'), false)
})

test('CandidateCard shows decide buttons for a proposed candidate in the viewer\'s own lane', () => {
  const candidate = candidateFixture()
  const html = render(
    createElement(CandidateCard, { candidate, canDecide: true, busy: false, onAccept: () => {}, onDecline: () => {} }),
  )
  assert.ok(html.includes('수락'))
  assert.ok(html.includes('거절'))
})

test('CandidateCard hides decide buttons once a candidate is no longer proposed, even if allowed', () => {
  const candidate = candidateFixture({ state: 'accepted' })
  const html = render(
    createElement(CandidateCard, { candidate, canDecide: true, busy: false, onAccept: () => {}, onDecline: () => {} }),
  )
  // The state badge itself legitimately reads "수락됨" ("accepted") — assert no <button> element
  // exists at all, rather than substring-matching "수락", which the badge text also contains.
  assert.equal(html.includes('<button'), false)
  assert.ok(html.includes('수락됨'))
})

// ---- family mode: only 가족 badges for a family-only payload ----

test('FamilyTaskList renders only 가족 scope badges for an all-family payload', () => {
  const tasks = [
    taskFixture({ id: 'a', personId: 'julie', privacyScope: 'family' }),
    taskFixture({ id: 'b', personId: 'jay', privacyScope: 'family', block: { reality: { title: 'Drive to practice' }, people: { subjectIds: ['jay'] } } }),
  ]
  const members = [
    { personId: 'julie', access: 'adult', label: 'Julie' },
    { personId: 'jay', access: 'adult', label: 'Jay' },
  ]
  const html = render(createElement(FamilyTaskList, { tasks, members }))
  assert.ok(html.includes('가족'))
  assert.equal(html.includes('개인'), false)
  assert.equal(html.includes('업무'), false)
  assert.ok(html.includes('Julie'))
  assert.ok(html.includes('Jay'))
})

test('FamilyTaskList would surface a leaked non-family scope rather than hide it (renders whatever the server sent)', () => {
  // Deliberately proves the component does not add its own filtering: if the server ever leaked
  // a personal-scope task into the family payload, this presentational component would still
  // show it, so a server-side regression is visible rather than silently masked client-side.
  const tasks = [taskFixture({ id: 'leak', privacyScope: 'personal' })]
  const members = [{ personId: 'julie', access: 'adult', label: 'Julie' }]
  const html = render(createElement(FamilyTaskList, { tasks, members }))
  assert.ok(html.includes('개인'))
})

test('FamilyTaskList shows an empty-state message for no family tasks', () => {
  const html = render(createElement(FamilyTaskList, { tasks: [], members: [] }))
  assert.ok(html.includes('아직'))
})
