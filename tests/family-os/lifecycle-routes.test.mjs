import test from 'node:test'
import assert from 'node:assert/strict'

// `next/server` has no ESM `exports` map — Next's own bundler resolves the extensionless
// specifier, but a bare `node --test` run needs the concrete file.
import { NextRequest } from 'next/server.js'

import { HOUSEHOLD_SESSION_COOKIE, householdSessionToken } from '../../lib/server/google-household-session.ts'
import { __setLifecycleStoreForTests } from '../../lib/server/lifecycle-runtime.ts'
import { createMemoryLifecycleStore } from '../../lib/server/lifecycle-store.ts'

import { POST as captureRoute } from '../../app/api/lifecycle/capture/route.ts'
import { POST as chatCaptureRoute } from '../../app/api/chat/capture/route.ts'
import { GET as candidatesRoute } from '../../app/api/lifecycle/candidates/route.ts'
import { POST as decideRoute } from '../../app/api/lifecycle/candidates/[id]/decide/route.ts'
import { GET as tasksRoute } from '../../app/api/lifecycle/tasks/route.ts'
import { PATCH as taskRoute } from '../../app/api/lifecycle/tasks/[id]/route.ts'

const ORIGIN = 'http://localhost:3000'
const AUTH_SECRET = 'test-auth-secret'
const MEMBERSHIP = [
  { personId: 'jay', googleSub: 'sub-jay', access: 'adult', roles: ['admin'] },
  { personId: 'julie', googleSub: 'sub-julie', access: 'adult', roles: ['admin'] },
  { personId: 'jayden', googleSub: 'sub-jayden', access: 'child', roles: ['child'] },
]

process.env.DORANDORAN_AUTH_SECRET = AUTH_SECRET
process.env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON = JSON.stringify(MEMBERSHIP)
// __setLifecycleStoreForTests refuses to run when NODE_ENV === 'production' — make the intent
// explicit rather than relying on it merely being unset.
process.env.NODE_ENV = 'test'

test.beforeEach(() => {
  __setLifecycleStoreForTests(createMemoryLifecycleStore())
})

test.after(() => {
  __setLifecycleStoreForTests(null)
})

async function cookieFor(personId) {
  const googleSub = MEMBERSHIP.find((member) => member.personId === personId).googleSub
  const token = await householdSessionToken(googleSub, AUTH_SECRET, Date.now() + 60_000)
  return `${HOUSEHOLD_SESSION_COOKIE}=${token}`
}

async function request(personId, { method = 'GET', path, origin, body, withCookie = true } = {}) {
  const headers = {}
  // `origin: null` deliberately omits the header (fail-closed test); leaving it unset defaults to
  // same-origin, since most tests aren't exercising this boundary at all.
  if (origin !== null) headers.origin = origin ?? ORIGIN
  if (withCookie && personId) headers.cookie = await cookieFor(personId)
  if (body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function params(id) {
  return { params: Promise.resolve({ id }) }
}

// ---- auth ----

test('POST /capture without a session cookie is 401 AUTH_REQUIRED', async () => {
  const req = await request(null, {
    method: 'POST',
    path: '/api/lifecycle/capture',
    withCookie: false,
    body: { privacyScope: 'family', kind: 'want', statedText: 'ride bikes', source: 'human' },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'AUTH_REQUIRED' })
})

// ---- same-origin ----

test('POST /capture with no Origin header is 403 ORIGIN_DENIED (fail closed)', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    origin: null,
    body: { privacyScope: 'family', kind: 'want', statedText: 'ride bikes', source: 'human' },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'ORIGIN_DENIED' })
})

test('POST /capture with a foreign Origin header is 403 ORIGIN_DENIED', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    origin: 'https://evil.example.com',
    body: { privacyScope: 'family', kind: 'want', statedText: 'ride bikes', source: 'human' },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'ORIGIN_DENIED' })
})

// ---- body validation ----

test('POST /capture with an unparsable body is 400 BODY_INVALID', async () => {
  const req = new NextRequest(`${ORIGIN}/api/lifecycle/capture`, {
    method: 'POST',
    headers: { origin: ORIGIN, cookie: await cookieFor('julie'), 'content-type': 'application/json' },
    body: '{not json',
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'BODY_INVALID' })
})

test('POST /capture missing a required field is 400 BODY_INVALID', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    body: { privacyScope: 'family', kind: 'want', source: 'human' }, // no statedText
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'BODY_INVALID' })
})

// ---- capture (happy path) ----

test('POST /capture succeeds 201 for the viewer\'s own lane', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    body: { privacyScope: 'family', kind: 'want', statedText: '주말에 자전거 타고 싶어', source: 'human' },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 201)
  const payload = await res.json()
  assert.equal(payload.capture.personId, 'julie')
  assert.equal(payload.capture.capturedBy, 'julie')
  assert.equal(payload.candidate, undefined)
})

test('POST /capture with propose returns a candidate', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    body: {
      privacyScope: 'family',
      kind: 'want',
      statedText: 'ride bikes',
      source: 'human',
      propose: { mode: 'physical', estimatedMinutes: 45 },
    },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 201)
  const payload = await res.json()
  assert.ok(payload.candidate)
  assert.equal(payload.candidate.sourceCaptureId, payload.capture.id)
})

test('POST /chat/capture stores an explicit human capture and strips client evidence fields', async () => {
  const req = await request('julie', {
    method: 'POST',
    path: '/api/chat/capture',
    body: {
      privacyScope: 'family',
      kind: 'decision',
      statedText: '이번 주말은 집에서 쉬기로 했어',
      source: 'ai',
      evidenceRefs: ['client-forged-ref'],
      unknowns: ['client-forged-unknown'],
    },
  })
  const res = await chatCaptureRoute(req)
  assert.equal(res.status, 201)
  const payload = await res.json()
  assert.equal(payload.capture.personId, 'julie')
  assert.equal(payload.capture.capturedBy, 'julie')
  assert.equal(payload.capture.source, 'human')
  assert.deepEqual(payload.capture.evidenceRefs, [])
  assert.deepEqual(payload.capture.unknowns, [])
  assert.equal(payload.candidate, undefined)
})

test('POST /chat/capture with explicit proposal returns a candidate but never a task', async () => {
  const req = await request('jay', {
    method: 'POST',
    path: '/api/chat/capture',
    body: {
      privacyScope: 'family',
      kind: 'want',
      statedText: '제이든 수영 준비물을 확인하자',
      propose: { mode: 'together', estimatedMinutes: 15 },
    },
  })
  const res = await chatCaptureRoute(req)
  assert.equal(res.status, 201)
  const payload = await res.json()
  assert.ok(payload.candidate)
  assert.equal(payload.candidate.sourceCaptureId, payload.capture.id)
  assert.equal(payload.task, undefined)
})

// ---- cross-lane read: 404, never 403 ----

test('a professional candidate in one lane is invisible to another adult by id — 404', async () => {
  const captureReq = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    body: {
      privacyScope: 'professional',
      kind: 'want',
      statedText: 'work only',
      source: 'human',
      propose: { mode: 'digital' },
    },
  })
  const captureRes = await captureRoute(captureReq)
  const { candidate } = await captureRes.json()

  const decideReq = await request('jay', {
    method: 'POST',
    path: `/api/lifecycle/candidates/${candidate.id}/decide`,
    body: { personId: 'julie', kind: 'accept', expectedVersion: 1 },
  })
  const decideRes = await decideRoute(decideReq, params(candidate.id))
  assert.equal(decideRes.status, 404)
  assert.deepEqual(await decideRes.json(), { error: 'CANDIDATE_NOT_FOUND' })
})

// ---- GET listing ----

test('GET /candidates?person= lists only what the viewer may read', async () => {
  await captureRoute(
    await request('julie', {
      method: 'POST',
      path: '/api/lifecycle/capture',
      body: {
        privacyScope: 'family',
        kind: 'want',
        statedText: 'family want',
        source: 'human',
        propose: { mode: 'physical' },
      },
    }),
  )
  await captureRoute(
    await request('julie', {
      method: 'POST',
      path: '/api/lifecycle/capture',
      body: {
        privacyScope: 'personal',
        kind: 'want',
        statedText: 'personal want',
        source: 'human',
        propose: { mode: 'physical' },
      },
    }),
  )

  const req = await request('jay', { method: 'GET', path: '/api/lifecycle/candidates?person=julie' })
  const res = await candidatesRoute(req)
  assert.equal(res.status, 200)
  const { candidates } = await res.json()
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].privacyScope, 'family')
})

// ---- decide + version conflict ----

test('decide accept then a stale expectedVersion retry is 409 VERSION_CONFLICT', async () => {
  const captureRes = await captureRoute(
    await request('julie', {
      method: 'POST',
      path: '/api/lifecycle/capture',
      body: {
        privacyScope: 'family',
        kind: 'want',
        statedText: 'ride bikes',
        source: 'human',
        propose: { mode: 'physical' },
      },
    }),
  )
  const { candidate } = await captureRes.json()

  const firstDecide = await decideRoute(
    await request('julie', {
      method: 'POST',
      path: `/api/lifecycle/candidates/${candidate.id}/decide`,
      body: { personId: 'julie', kind: 'accept', expectedVersion: 1 },
    }),
    params(candidate.id),
  )
  assert.equal(firstDecide.status, 200)
  const firstPayload = await firstDecide.json()
  assert.ok(firstPayload.task)
  assert.equal(firstPayload.task.block.digital.executor, undefined)

  const staleRetry = await decideRoute(
    await request('julie', {
      method: 'POST',
      path: `/api/lifecycle/candidates/${candidate.id}/decide`,
      body: { personId: 'julie', kind: 'accept', expectedVersion: 1 },
    }),
    params(candidate.id),
  )
  assert.equal(staleRetry.status, 409)
  assert.deepEqual(await staleRetry.json(), { error: 'CANDIDATE_ALREADY_DECIDED' })
})

// ---- task transition through the route ----

test('PATCH /tasks/:id transitions work state and enforces readback on done', async () => {
  const captureRes = await captureRoute(
    await request('julie', {
      method: 'POST',
      path: '/api/lifecycle/capture',
      body: {
        privacyScope: 'family',
        kind: 'want',
        statedText: 'ride bikes',
        source: 'human',
        propose: { mode: 'physical' },
      },
    }),
  )
  const { candidate } = await captureRes.json()

  const decideRes = await decideRoute(
    await request('julie', {
      method: 'POST',
      path: `/api/lifecycle/candidates/${candidate.id}/decide`,
      body: { personId: 'julie', kind: 'accept', expectedVersion: 1 },
    }),
    params(candidate.id),
  )
  const { task } = await decideRes.json()

  const inProgressRes = await taskRoute(
    await request('julie', {
      method: 'PATCH',
      path: `/api/lifecycle/tasks/${task.id}`,
      body: { personId: 'julie', next: 'in_progress', expectedVersion: 1 },
    }),
    params(task.id),
  )
  assert.equal(inProgressRes.status, 200)
  assert.equal((await inProgressRes.json()).task.workState, 'in_progress')

  const doneWithoutEvidence = await taskRoute(
    await request('julie', {
      method: 'PATCH',
      path: `/api/lifecycle/tasks/${task.id}`,
      body: { personId: 'julie', next: 'done', expectedVersion: 2 },
    }),
    params(task.id),
  )
  assert.equal(doneWithoutEvidence.status, 400)
  assert.deepEqual(await doneWithoutEvidence.json(), { error: 'READBACK_EVIDENCE_REQUIRED' })

  const doneRes = await taskRoute(
    await request('julie', {
      method: 'PATCH',
      path: `/api/lifecycle/tasks/${task.id}`,
      body: { personId: 'julie', next: 'done', readbackEvidenceRefs: ['ev-done'], expectedVersion: 2 },
    }),
    params(task.id),
  )
  assert.equal(doneRes.status, 200)
  assert.equal((await doneRes.json()).task.workState, 'done')
})

test('GET /tasks?scope=family never leaks a personal or professional task', async () => {
  const captureRes = await captureRoute(
    await request('jay', {
      method: 'POST',
      path: '/api/lifecycle/capture',
      body: {
        privacyScope: 'professional',
        kind: 'want',
        statedText: 'work task',
        source: 'human',
        propose: { mode: 'digital' },
      },
    }),
  )
  const { candidate } = await captureRes.json()
  await decideRoute(
    await request('jay', {
      method: 'POST',
      path: `/api/lifecycle/candidates/${candidate.id}/decide`,
      body: { personId: 'jay', kind: 'accept', expectedVersion: 1 },
    }),
    params(candidate.id),
  )

  const res = await tasksRoute(await request('julie', { method: 'GET', path: '/api/lifecycle/tasks?scope=family' }))
  assert.equal(res.status, 200)
  const { tasks } = await res.json()
  assert.equal(tasks.length, 0)
})

// ---- store unavailable ----

test('when no lifecycle store is configured, routes fail closed to 503', async () => {
  __setLifecycleStoreForTests(null)
  const req = await request('julie', {
    method: 'POST',
    path: '/api/lifecycle/capture',
    body: { privacyScope: 'family', kind: 'want', statedText: 'ride bikes', source: 'human' },
  })
  const res = await captureRoute(req)
  assert.equal(res.status, 503)
  assert.deepEqual(await res.json(), { error: 'LIFECYCLE_STORE_UNAVAILABLE' })
})

// ---- test-hook production guard ----

test('__setLifecycleStoreForTests refuses to run when NODE_ENV is production', () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    assert.throws(
      () => __setLifecycleStoreForTests(createMemoryLifecycleStore()),
      /LIFECYCLE_TEST_HOOK_FORBIDDEN_IN_PRODUCTION/,
    )
  } finally {
    process.env.NODE_ENV = previous
  }
})
