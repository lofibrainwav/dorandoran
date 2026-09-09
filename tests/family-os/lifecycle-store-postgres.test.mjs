import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clampLimit,
  closeLifecycleStorePool,
  createLifecycleStoreFromEnv,
  createPostgresLifecycleStore,
} from '../../lib/server/lifecycle-store.ts'

/** A fake `query` that plays back a scripted sequence of responses and records every call
 * (SQL text + params) so the assertions below can inspect exactly what was sent — no real
 * database is ever touched. */
function createFakeQuery(script) {
  const calls = []
  let cursor = 0
  const query = async (text, params = []) => {
    calls.push({ text, params })
    const next = script[cursor++]
    if (!next) throw new Error(`lifecycle-store-postgres.test.mjs: no scripted response for call #${cursor}: ${text}`)
    if (next.error) throw next.error
    return { rows: next.rows ?? [], rowCount: next.rowCount ?? (next.rows ? next.rows.length : 0) }
  }
  return { query, calls }
}

/** A fake `transaction` that mirrors the real BEGIN/COMMIT/ROLLBACK shape: it records a `BEGIN`
 * call, hands the scripted fake query to `fn`, then records `COMMIT` on success or `ROLLBACK` (and
 * rethrows unchanged) on failure — exactly like `createLifecycleStoreFromEnv`'s real
 * `pool.connect()` + BEGIN/COMMIT/ROLLBACK implementation, without ever touching a real database. */
function createFakeTransaction(script) {
  const { query, calls } = createFakeQuery(script)
  async function transaction(fn) {
    calls.push({ text: 'BEGIN', params: [] })
    try {
      const result = await fn(query)
      calls.push({ text: 'COMMIT', params: [] })
      return result
    } catch (error) {
      calls.push({ text: 'ROLLBACK', params: [] })
      throw error
    }
  }
  return { transaction, calls }
}

/** A fake `query` that actually applies the `id = $1 AND person_id = $2 AND privacy_scope =
 * ANY($3)` by-id filter against a small in-memory table per SQL table name — a faithful enough
 * simulation of the real WHERE clause to prove the scope boundary holds end to end, still without
 * ever touching a real database. */
function createLaneAwareFakeQuery(tableToRows) {
  const calls = []
  const query = async (text, params = []) => {
    calls.push({ text, params })
    const tableMatch = text.match(/FROM (lifecycle_\w+)/)
    const table = tableMatch ? tableMatch[1] : null
    const rows = tableToRows[table] ?? []
    if (text.includes('id = $1 AND person_id = $2 AND privacy_scope = ANY($3)')) {
      const [id, personId, scopes] = params
      const matched = rows.filter((row) => row.id === id && row.person_id === personId && scopes.includes(row.privacy_scope))
      return { rows: matched, rowCount: matched.length }
    }
    return { rows, rowCount: rows.length }
  }
  return { query, calls }
}

function capture(overrides = {}) {
  return {
    id: 'cap-1',
    personId: 'julie',
    privacyScope: 'family',
    kind: 'want',
    statedText: '주말에 자전거 타고 싶어',
    source: 'human',
    occurredAt: '2026-09-08T10:00:00.000Z',
    capturedAt: '2026-09-08T10:00:05.000Z',
    capturedBy: 'julie',
    evidenceRefs: ['ev-capture-1'],
    unknowns: [],
    ...overrides,
  }
}

function captureRow(overrides = {}) {
  return {
    id: 'cap-1',
    person_id: 'julie',
    privacy_scope: 'family',
    kind: 'want',
    stated_text: '주말에 자전거 타고 싶어',
    source: 'human',
    occurred_at: '2026-09-08T10:00:00.000Z',
    captured_at: '2026-09-08T10:00:05.000Z',
    captured_by: 'julie',
    evidence_refs: ['ev-capture-1'],
    unknowns: [],
    ...overrides,
  }
}

function opportunity(overrides = {}) {
  return {
    id: 'opp-1',
    ownerId: 'julie',
    title: '자전거 라이딩',
    mode: 'physical',
    evidenceRefs: ['ev-capture-1'],
    ...overrides,
  }
}

function candidateRow(overrides = {}) {
  return {
    id: 'cand-1',
    person_id: 'julie',
    privacy_scope: 'family',
    source_capture_id: 'cap-1',
    proposed_by: 'julie',
    opportunity: opportunity(),
    decision: null,
    version: 1,
    created_at: '2026-09-08T10:01:00.000Z',
    updated_at: '2026-09-08T10:01:00.000Z',
    ...overrides,
  }
}

function candidateRecord(overrides = {}) {
  return {
    id: 'cand-1',
    personId: 'julie',
    privacyScope: 'family',
    sourceCaptureId: 'cap-1',
    proposedBy: 'julie',
    opportunity: opportunity(),
    version: 1,
    createdAt: '2026-09-08T10:01:00.000Z',
    updatedAt: '2026-09-08T10:05:00.000Z',
    ...overrides,
  }
}

function familyBlock(overrides = {}) {
  return {
    id: 'task-1',
    type: 'action',
    workMode: 'physical',
    reality: { title: '자전거 라이딩', durationMinutes: 60 },
    evidenceRefs: ['ev-capture-1'],
    evidenceState: 'unknown',
    people: { subjectIds: ['julie'], physicalOwnerIds: [], approverIds: ['julie'], recipientIds: [] },
    digital: { jobs: [] },
    timeEngine: { protected: false },
    dependencyIds: [],
    childBlockIds: [],
    workState: 'open',
    candidateId: 'cand-1',
    privacyScope: 'family',
    ...overrides,
  }
}

function taskRow(overrides = {}) {
  return {
    id: 'task-1',
    person_id: 'julie',
    privacy_scope: 'family',
    candidate_id: 'cand-1',
    block: familyBlock(),
    work_state: 'open',
    authority_ref: null,
    version: 1,
    created_at: '2026-09-08T10:02:00.000Z',
    updated_at: '2026-09-08T10:02:00.000Z',
    ...overrides,
  }
}

function taskRecord(overrides = {}) {
  return {
    id: 'task-1',
    personId: 'julie',
    privacyScope: 'family',
    candidateId: 'cand-1',
    block: familyBlock(),
    workState: 'open',
    version: 1,
    createdAt: '2026-09-08T10:02:00.000Z',
    updatedAt: '2026-09-08T10:10:00.000Z',
    ...overrides,
  }
}

test('putCapture inserts with parameterized placeholders, never string-concatenated values', async () => {
  const { query, calls } = createFakeQuery([{ rows: [], rowCount: 1 }])
  const store = createPostgresLifecycleStore({ query })
  await store.putCapture(capture())

  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /INSERT INTO lifecycle_capture/)
  assert.match(calls[0].text, /\$1/)
  assert.ok(!calls[0].text.includes('cap-1'), 'the raw id must never be concatenated into the SQL text')
  assert.ok(!calls[0].text.includes('주말에'), 'the raw statedText must never be concatenated into the SQL text')
  assert.deepEqual(calls[0].params[0], 'cap-1')
  assert.deepEqual(JSON.parse(calls[0].params[9]), capture().evidenceRefs)
})

test('putCapture converts a unique-violation into LIFECYCLE_DUPLICATE_ID', async () => {
  const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
  const { query } = createFakeQuery([{ error: duplicateError }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(() => store.putCapture(capture()), /LIFECYCLE_DUPLICATE_ID/)
})

test('getCapture / getCandidate / getTask filter by id, person_id, and privacy_scope = ANY(, and never query with empty scopes', async () => {
  const { query: captureQuery, calls: captureCalls } = createFakeQuery([{ rows: [captureRow()] }])
  const captureStore = createPostgresLifecycleStore({ query: captureQuery })
  const found = await captureStore.getCapture({ id: 'cap-1', personId: 'julie', scopes: ['family', 'professional'] })
  assert.equal(found.id, 'cap-1')
  assert.match(captureCalls[0].text, /WHERE id = \$1 AND person_id = \$2 AND privacy_scope = ANY\(\$3\)/)
  assert.deepEqual(captureCalls[0].params, ['cap-1', 'julie', ['family', 'professional']])

  const emptyScopeStore = createPostgresLifecycleStore({ query: createFakeQuery([]).query })
  assert.equal(await emptyScopeStore.getCapture({ id: 'cap-1', personId: 'julie', scopes: [] }), null)
  assert.equal(await emptyScopeStore.getCandidate({ id: 'cand-1', personId: 'julie', scopes: [] }), null)
  assert.equal(await emptyScopeStore.getTask({ id: 'task-1', personId: 'julie', scopes: [] }), null)
})

test('professional row is not returned by id to another lane', async () => {
  const { query } = createLaneAwareFakeQuery({
    lifecycle_capture: [captureRow({ id: 'cap-pro', person_id: 'julie', privacy_scope: 'professional' })],
    lifecycle_candidate: [candidateRow({ id: 'cand-pro', person_id: 'julie', privacy_scope: 'professional' })],
    lifecycle_task: [taskRow({ id: 'task-pro', person_id: 'julie', privacy_scope: 'professional', candidate_id: 'cand-pro' })],
  })
  const store = createPostgresLifecycleStore({ query })

  assert.equal(
    await store.getCapture({ id: 'cap-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
    'wrong personId must never see a professional row, whatever scopes are supplied',
  )
  assert.equal(
    await store.getCapture({ id: 'cap-pro', personId: 'julie', scopes: ['personal', 'family'] }),
    null,
    'own lane but missing the professional scope must still be denied',
  )
  const visibleCapture = await store.getCapture({ id: 'cap-pro', personId: 'julie', scopes: ['professional'] })
  assert.equal(visibleCapture.id, 'cap-pro')

  assert.equal(
    await store.getCandidate({ id: 'cand-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
  )
  assert.equal(await store.getCandidate({ id: 'cand-pro', personId: 'julie', scopes: ['personal', 'family'] }), null)

  assert.equal(
    await store.getTask({ id: 'task-pro', personId: 'jay', scopes: ['personal', 'family', 'professional'] }),
    null,
  )
  assert.equal(await store.getTask({ id: 'task-pro', personId: 'julie', scopes: ['personal', 'family'] }), null)
})

test('listCaptures always includes privacy_scope = ANY( and orders captured_at DESC, id ASC', async () => {
  const { query, calls } = createFakeQuery([{ rows: [captureRow()] }])
  const store = createPostgresLifecycleStore({ query })

  const result = await store.listCaptures({ personId: 'julie', scopes: ['family', 'professional'] })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'cap-1')
  assert.match(calls[0].text, /privacy_scope = ANY\(/)
  assert.match(calls[0].text, /ORDER BY captured_at DESC, id ASC/)
  assert.deepEqual(calls[0].params[1], ['family', 'professional'])

  const empty = await store.listCaptures({ personId: 'julie', scopes: [] })
  assert.deepEqual(empty, [])
  assert.equal(calls.length, 1, 'an empty scopes array must never reach the database')
})

test('listCandidates always includes privacy_scope = ANY( and orders updated_at DESC, id ASC', async () => {
  const { query, calls } = createFakeQuery([{ rows: [candidateRow()] }])
  const store = createPostgresLifecycleStore({ query })
  const result = await store.listCandidates({ personId: 'julie', scopes: ['family'] })
  assert.equal(result.length, 1)
  assert.match(calls[0].text, /privacy_scope = ANY\(/)
  assert.match(calls[0].text, /ORDER BY updated_at DESC, id ASC/)
})

test('listTasks always includes privacy_scope = ANY(, adds work_state = ANY( when workStates is given, and orders updated_at DESC, id ASC', async () => {
  const { query, calls } = createFakeQuery([{ rows: [taskRow()] }, { rows: [taskRow()] }])
  const store = createPostgresLifecycleStore({ query })

  await store.listTasks({ personId: 'julie', scopes: ['family'] })
  assert.match(calls[0].text, /privacy_scope = ANY\(/)
  assert.match(calls[0].text, /ORDER BY updated_at DESC, id ASC/)
  assert.ok(!calls[0].text.includes('work_state = ANY('))

  await store.listTasks({ personId: 'julie', scopes: ['family'], workStates: ['open', 'in_progress'] })
  assert.match(calls[1].text, /privacy_scope = ANY\(/)
  assert.match(calls[1].text, /work_state = ANY\(/)
  assert.match(calls[1].text, /ORDER BY updated_at DESC, id ASC/)

  const empty = await store.listTasks({ personId: 'julie', scopes: [] })
  assert.deepEqual(empty, [])
  assert.equal(calls.length, 2, 'an empty scopes array must never reach the database')
})

test('list methods reject an invalid limit before ever querying, and clamp above 500', async () => {
  const { query, calls } = createFakeQuery([{ rows: [captureRow()] }])
  const store = createPostgresLifecycleStore({ query })

  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 0 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: -3 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  await assert.rejects(
    () => store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 2.5 }),
    /LIFECYCLE_LIMIT_INVALID/,
  )
  assert.equal(calls.length, 0, 'an invalid limit must never reach the database')

  await store.listCaptures({ personId: 'julie', scopes: ['family'], limit: 10_000 })
  assert.equal(calls[0].params[2], 500)
})

test('updateCandidate issues an UPDATE with AND version = and rowCount 0 raises LIFECYCLE_VERSION_CONFLICT', async () => {
  const { query, calls } = createFakeQuery([{ rows: [], rowCount: 0 }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(() => store.updateCandidate(candidateRecord(), 1), /LIFECYCLE_VERSION_CONFLICT/)
  assert.match(calls[0].text, /UPDATE lifecycle_candidate/)
  assert.match(calls[0].text, /AND version = /)
})

test('updateCandidate succeeds when rowCount is 1', async () => {
  const { query } = createFakeQuery([{ rows: [], rowCount: 1 }])
  const store = createPostgresLifecycleStore({ query })
  await assert.doesNotReject(() => store.updateCandidate(candidateRecord(), 1))
})

test('updateTask issues an UPDATE with AND version = and rowCount 0 raises LIFECYCLE_VERSION_CONFLICT', async () => {
  const { query, calls } = createFakeQuery([{ rows: [], rowCount: 0 }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(() => store.updateTask(taskRecord(), 1), /LIFECYCLE_VERSION_CONFLICT/)
  assert.match(calls[0].text, /UPDATE lifecycle_task/)
  assert.match(calls[0].text, /AND version = /)
})

test('insertCandidate and insertTask convert an ordinary unique-violation into LIFECYCLE_DUPLICATE_ID', async () => {
  const duplicateError = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'lifecycle_candidate_pkey' })
  const store1 = createPostgresLifecycleStore({ query: createFakeQuery([{ error: duplicateError }]).query })
  await assert.rejects(() => store1.insertCandidate(candidateRecord()), /LIFECYCLE_DUPLICATE_ID/)

  const taskPkeyError = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'lifecycle_task_pkey' })
  const store2 = createPostgresLifecycleStore({ query: createFakeQuery([{ error: taskPkeyError }]).query })
  await assert.rejects(() => store2.insertTask(taskRecord()), /LIFECYCLE_DUPLICATE_ID/)
})

test('insertTask converts a candidate_id unique-violation into LIFECYCLE_CANDIDATE_ALREADY_TASKED', async () => {
  const candidateIdViolation = Object.assign(new Error('duplicate key'), {
    code: '23505',
    constraint: 'lifecycle_task_candidate_id_key',
  })
  const store = createPostgresLifecycleStore({ query: createFakeQuery([{ error: candidateIdViolation }]).query })
  await assert.rejects(() => store.insertTask(taskRecord()), /LIFECYCLE_CANDIDATE_ALREADY_TASKED/)
})

test('a non-unique-violation error is rethrown unchanged', async () => {
  const otherError = Object.assign(new Error('connection terminated'), { code: '57P01' })
  const { query } = createFakeQuery([{ error: otherError }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(() => store.putCapture(capture()), /connection terminated/)
})

test('row guard rejects a malformed capture row (invalid privacy_scope enum)', async () => {
  const { query } = createFakeQuery([{ rows: [captureRow({ privacy_scope: 'not-a-real-scope' })] }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(
    () => store.getCapture({ id: 'cap-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )
})

test('row guard rejects a malformed candidate row (opportunity jsonb missing required fields)', async () => {
  const { query } = createFakeQuery([{ rows: [candidateRow({ opportunity: { id: 'opp-1' } })] }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(
    () => store.getCandidate({ id: 'cand-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )
})

test('row guard rejects a malformed candidate row (evidenceRefs not an array)', async () => {
  const { query } = createFakeQuery([
    { rows: [candidateRow({ opportunity: opportunity({ evidenceRefs: 'not-an-array' }) })] },
  ])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(
    () => store.getCandidate({ id: 'cand-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )
})

test('row guard rejects a malformed task row (block jsonb missing required nested fields)', async () => {
  const { query } = createFakeQuery([{ rows: [taskRow({ block: { id: 'task-1', type: 'action' } })] }])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(
    () => store.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )
})

test('row guard rejects block.digital.jobs entries that are not { jobId: string }', async () => {
  const missingJobId = createFakeQuery([{ rows: [taskRow({ block: familyBlock({ digital: { jobs: [{ notJobId: 'x' }] } }) })] }])
  const store1 = createPostgresLifecycleStore({ query: missingJobId.query })
  await assert.rejects(
    () => store1.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )

  const notAnObject = createFakeQuery([{ rows: [taskRow({ block: familyBlock({ digital: { jobs: ['job-1'] } }) })] }])
  const store2 = createPostgresLifecycleStore({ query: notAnObject.query })
  await assert.rejects(
    () => store2.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )

  const jobsNotArray = createFakeQuery([{ rows: [taskRow({ block: familyBlock({ digital: { jobs: 'nope' } }) })] }])
  const store3 = createPostgresLifecycleStore({ query: jobsNotArray.query })
  await assert.rejects(
    () => store3.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] }),
    /LIFECYCLE_ROW_INVALID/,
  )
})

test('block.digital.jobs entries with a valid jobId map cleanly, dropping unrelated fields', async () => {
  const { query } = createFakeQuery([
    { rows: [taskRow({ block: familyBlock({ digital: { jobs: [{ jobId: 'job-1', unrelated: 'dropped' }] } }) })] },
  ])
  const store = createPostgresLifecycleStore({ query })
  const result = await store.getTask({ id: 'task-1', personId: 'julie', scopes: ['family'] })
  assert.deepEqual(result.block.digital.jobs, [{ jobId: 'job-1' }])
})

test('getCapture / getCandidate / getTask return null when no row is found, never throwing', async () => {
  const store = createPostgresLifecycleStore({ query: createFakeQuery([{ rows: [] }]).query })
  assert.equal(await store.getCapture({ id: 'missing', personId: 'julie', scopes: ['family'] }), null)
})

test('valid rows map cleanly to camelCase records', async () => {
  const store = createPostgresLifecycleStore({ query: createFakeQuery([{ rows: [candidateRow()] }]).query })
  const result = await store.getCandidate({ id: 'cand-1', personId: 'julie', scopes: ['family'] })
  assert.equal(result.sourceCaptureId, 'cap-1')
  assert.equal(result.proposedBy, 'julie')
  assert.equal(result.opportunity.ownerId, 'julie')
  assert.equal(result.decision, undefined)
})

test('clampLimit: default 50, integer 1..500, invalid values throw, >500 clamps to 500', () => {
  assert.equal(clampLimit(undefined), 50)
  assert.equal(clampLimit(1), 1)
  assert.equal(clampLimit(500), 500)
  assert.equal(clampLimit(10_000), 500)
  assert.throws(() => clampLimit(0), /LIFECYCLE_LIMIT_INVALID/)
  assert.throws(() => clampLimit(-1), /LIFECYCLE_LIMIT_INVALID/)
  assert.throws(() => clampLimit(1.5), /LIFECYCLE_LIMIT_INVALID/)
  assert.throws(() => clampLimit(Number.NaN), /LIFECYCLE_LIMIT_INVALID/)
  assert.throws(() => clampLimit(Number.POSITIVE_INFINITY), /LIFECYCLE_LIMIT_INVALID/)
})

test('createLifecycleStoreFromEnv returns null when neither DATABASE_URL nor POSTGRES_URL is set', () => {
  assert.equal(createLifecycleStoreFromEnv({}), null)
  assert.equal(createLifecycleStoreFromEnv({ DATABASE_URL: '', POSTGRES_URL: '  ' }), null)
})

test('createLifecycleStoreFromEnv never imports pg until a query actually runs', () => {
  // Building the store must not throw and must not require `pg` to be resolved yet — the
  // dynamic import only happens inside the first real query() call, never here.
  const store = createLifecycleStoreFromEnv({ DATABASE_URL: 'postgres://user:pass@127.0.0.1:1/db' })
  assert.ok(store)
  assert.equal(typeof store.getCapture, 'function')
})

test('closeLifecycleStorePool resolves cleanly even when no pool was ever created', async () => {
  await assert.doesNotReject(() => closeLifecycleStorePool())
})

// ---- acceptCandidate: atomic accept (candidate UPDATE + task INSERT in one transaction) ----

test('acceptCandidate fails closed to LIFECYCLE_TRANSACTION_UNAVAILABLE when no transaction runner is injected', async () => {
  const { query } = createFakeQuery([])
  const store = createPostgresLifecycleStore({ query })
  await assert.rejects(
    () => store.acceptCandidate({ candidate: candidateRecord(), expectedVersion: 1, task: taskRecord() }),
    /LIFECYCLE_TRANSACTION_UNAVAILABLE/,
  )
})

test('acceptCandidate runs BEGIN, UPDATE candidate, INSERT task, COMMIT — in that order, on one connection', async () => {
  const { transaction, calls } = createFakeTransaction([
    { rows: [], rowCount: 1 }, // UPDATE lifecycle_candidate
    { rows: [], rowCount: 1 }, // INSERT lifecycle_task
  ])
  const unusedQuery = async () => {
    throw new Error('acceptCandidate must run everything through the transaction query, never the bare one')
  }
  const store = createPostgresLifecycleStore({ query: unusedQuery, transaction })

  await store.acceptCandidate({ candidate: candidateRecord(), expectedVersion: 1, task: taskRecord() })

  assert.equal(calls.length, 4)
  assert.equal(calls[0].text, 'BEGIN')
  assert.match(calls[1].text, /UPDATE lifecycle_candidate/)
  assert.match(calls[1].text, /AND version = /)
  assert.match(calls[2].text, /INSERT INTO lifecycle_task/)
  assert.equal(calls[3].text, 'COMMIT')
})

test('acceptCandidate rolls back and never commits when the candidate version check fails, and never attempts the insert', async () => {
  const { transaction, calls } = createFakeTransaction([{ rows: [], rowCount: 0 }])
  const store = createPostgresLifecycleStore({
    query: async () => {
      throw new Error('unused')
    },
    transaction,
  })

  await assert.rejects(
    () => store.acceptCandidate({ candidate: candidateRecord(), expectedVersion: 1, task: taskRecord() }),
    /LIFECYCLE_VERSION_CONFLICT/,
  )

  assert.equal(calls.length, 3)
  assert.equal(calls[0].text, 'BEGIN')
  assert.match(calls[1].text, /UPDATE lifecycle_candidate/)
  assert.equal(calls[2].text, 'ROLLBACK')
})

test('acceptCandidate rolls back and leaves the candidate change undone when the task insert fails', async () => {
  const taskAlreadyExists = Object.assign(new Error('duplicate key'), {
    code: '23505',
    constraint: 'lifecycle_task_candidate_id_key',
  })
  const { transaction, calls } = createFakeTransaction([
    { rows: [], rowCount: 1 }, // UPDATE succeeds
    { error: taskAlreadyExists }, // INSERT fails
  ])
  const store = createPostgresLifecycleStore({
    query: async () => {
      throw new Error('unused')
    },
    transaction,
  })

  await assert.rejects(
    () => store.acceptCandidate({ candidate: candidateRecord(), expectedVersion: 1, task: taskRecord() }),
    /LIFECYCLE_CANDIDATE_ALREADY_TASKED/,
  )

  assert.equal(calls.length, 4)
  assert.equal(calls[0].text, 'BEGIN')
  assert.match(calls[1].text, /UPDATE lifecycle_candidate/)
  assert.match(calls[2].text, /INSERT INTO lifecycle_task/)
  assert.equal(calls[3].text, 'ROLLBACK')
  // No COMMIT anywhere in the call log — the candidate UPDATE from call #2 was rolled back with it,
  // even though the fake's UPDATE response alone reported success.
  assert.ok(!calls.some((call) => call.text === 'COMMIT'))
})

// ---- getTaskByCandidateId ----

test('getTaskByCandidateId filters by candidate_id, person_id, and privacy_scope = ANY(', async () => {
  const { query, calls } = createFakeQuery([{ rows: [taskRow()] }])
  const store = createPostgresLifecycleStore({ query })

  const result = await store.getTaskByCandidateId({ candidateId: 'cand-1', personId: 'julie', scopes: ['family'] })

  assert.match(calls[0].text, /candidate_id = \$1 AND person_id = \$2 AND privacy_scope = ANY\(\$3\)/)
  assert.deepEqual(calls[0].params, ['cand-1', 'julie', ['family']])
  assert.equal(result.id, 'task-1')
})

test('getTaskByCandidateId short-circuits to null on empty scopes, never querying', async () => {
  const { query, calls } = createFakeQuery([])
  const store = createPostgresLifecycleStore({ query })

  assert.equal(await store.getTaskByCandidateId({ candidateId: 'cand-1', personId: 'julie', scopes: [] }), null)
  assert.equal(calls.length, 0)
})

test('getTaskByCandidateId returns null when no row matches', async () => {
  const { query } = createFakeQuery([{ rows: [] }])
  const store = createPostgresLifecycleStore({ query })

  assert.equal(await store.getTaskByCandidateId({ candidateId: 'cand-missing', personId: 'julie', scopes: ['family'] }), null)
})
