import test from 'node:test'
import assert from 'node:assert/strict'

import { parseDorandoranHandoff } from '../../lib/family-os/drive-handoff-intake.ts'
import { buildArtifactRegistry } from '../../lib/family-os/artifact-registry.ts'
import { proposeCandidate, validateCaptureWrite } from '../../lib/family-os/lifecycle.ts'

const CONTEXT = { capturedBy: 'dorandoran-intake', capturedAt: '2026-09-09T08:00:00.000Z' }

function record(overrides = {}) {
  return {
    eventId: 'evt-1',
    occurredAt: '2026-09-08T10:00:00.000Z',
    person: 'jay',
    domain: 'career',
    kind: 'capture',
    privacyScope: 'personal',
    status: 'candidate',
    sourceSystem: 'chatgpt',
    sourceRefs: [],
    evidenceRefs: [],
    statedText: 'stated as-is',
    unknowns: [],
    candidateSuggested: false,
    requestedAction: 'none',
    ...overrides,
  }
}

function parse(overrides = {}, context = CONTEXT) {
  return parseDorandoranHandoff(record(overrides), context)
}

// ---- happy path per Drive kind ----

test('decision maps to capture kind decision and is actionable', () => {
  const result = parse({ kind: 'decision', candidateSuggested: true })
  assert.equal(result.ok, true)
  assert.equal(result.intake.capture.kind, 'decision')
  assert.equal(result.intake.proposeCandidate, true)

  const notSuggested = parse({ kind: 'decision', candidateSuggested: false })
  assert.equal(notSuggested.intake.proposeCandidate, false)
})

test('final_artifact maps to capture kind final_artifact and is actionable', () => {
  const result = parse({ kind: 'final_artifact', candidateSuggested: true })
  assert.equal(result.ok, true)
  assert.equal(result.intake.capture.kind, 'final_artifact')
  assert.equal(result.intake.proposeCandidate, true)
})

test('capture maps to want when candidateSuggested, fact otherwise', () => {
  const suggested = parse({ kind: 'capture', candidateSuggested: true })
  assert.equal(suggested.ok, true)
  assert.equal(suggested.intake.capture.kind, 'want')
  assert.equal(suggested.intake.proposeCandidate, true)

  const notSuggested = parse({ kind: 'capture', candidateSuggested: false })
  assert.equal(notSuggested.ok, true)
  assert.equal(notSuggested.intake.capture.kind, 'fact')
  assert.equal(notSuggested.intake.proposeCandidate, false)
})

test('task_receipt, learning_event, calendar_change, source_update always map to fact and are never actionable', () => {
  for (const kind of ['task_receipt', 'learning_event', 'calendar_change', 'source_update']) {
    for (const candidateSuggested of [true, false]) {
      const result = parse({ kind, candidateSuggested })
      assert.equal(result.ok, true, `${kind} should be valid`)
      assert.equal(result.intake.capture.kind, 'fact', `${kind} maps to fact`)
      assert.equal(result.intake.proposeCandidate, false, `${kind} never proposes`)
    }
  }
})

// ---- source mapping ----

test('sourceSystem maps to EvidenceRef sourceType', () => {
  const cases = [
    ['drive', 'file'],
    ['calendar', 'calendar'],
    ['human', 'human'],
    ['chatgpt', 'system'],
    ['gemini', 'system'],
    ['grok', 'system'],
    ['claude', 'system'],
    ['jdk', 'system'],
    ['kingdom', 'system'],
    ['hyodo', 'system'],
  ]
  for (const [sourceSystem, sourceType] of cases) {
    const result = parse({ sourceSystem })
    assert.equal(result.ok, true, sourceSystem)
    assert.equal(result.intake.capture.source, sourceType, sourceSystem)
  }
})

// ---- reject codes, each with the offending field ----

test('FIELD_MISSING for an absent required field', () => {
  const body = record()
  delete body.eventId
  const result = parseDorandoranHandoff(body, CONTEXT)
  assert.deepEqual(result, { ok: false, code: 'FIELD_MISSING', field: 'eventId' })
})

test('FIELD_INVALID for a wrong-enum value', () => {
  const result = parse({ person: 'not-a-person' })
  assert.deepEqual(result, { ok: false, code: 'FIELD_INVALID', field: 'person' })
})

test('FIELD_INVALID for an unparseable occurredAt', () => {
  const result = parse({ occurredAt: 'not-a-date' })
  assert.deepEqual(result, { ok: false, code: 'FIELD_INVALID', field: 'occurredAt' })
})

test('ACCEPT_BY_AI_FORBIDDEN when a non-human source requests accept_candidate', () => {
  const result = parse({ requestedAction: 'accept_candidate', sourceSystem: 'claude' })
  assert.deepEqual(result, { ok: false, code: 'ACCEPT_BY_AI_FORBIDDEN', field: 'sourceSystem' })
})

test('PRIVACY_PERSON_MISMATCH when person family does not carry family scope', () => {
  const result = parse({ person: 'family', privacyScope: 'personal' })
  assert.deepEqual(result, { ok: false, code: 'PRIVACY_PERSON_MISMATCH', field: 'privacyScope' })
})

test('SECRET_LIKE_CONTENT when statedText looks like a credential', () => {
  const result = parse({ statedText: 'here is my key AIzaSyD1234567890abcdefghijk' })
  assert.deepEqual(result, { ok: false, code: 'SECRET_LIKE_CONTENT', field: 'statedText' })
})

// ---- person: family, accepted and rejected ----

test('person family is accepted only with privacyScope family', () => {
  const accepted = parse({ person: 'family', privacyScope: 'family' })
  assert.equal(accepted.ok, true)
  assert.equal(accepted.intake.capture.personId, 'family')

  const rejectedPersonal = parse({ person: 'family', privacyScope: 'personal' })
  assert.deepEqual(rejectedPersonal, { ok: false, code: 'PRIVACY_PERSON_MISMATCH', field: 'privacyScope' })

  const rejectedProfessional = parse({ person: 'family', privacyScope: 'professional' })
  assert.deepEqual(rejectedProfessional, { ok: false, code: 'PRIVACY_PERSON_MISMATCH', field: 'privacyScope' })
})

// ---- accept_candidate: human vs AI ----

test('accept_candidate from a human source proposes a candidate only when the mapped kind is actionable', () => {
  const actionable = parse({
    kind: 'decision',
    candidateSuggested: false,
    sourceSystem: 'human',
    requestedAction: 'accept_candidate',
  })
  assert.equal(actionable.ok, true)
  assert.equal(actionable.intake.proposeCandidate, true)
  assert.equal(actionable.intake.provenance.requestedAction, 'accept_candidate')

  const nonActionable = parse({
    kind: 'task_receipt',
    candidateSuggested: false,
    sourceSystem: 'human',
    requestedAction: 'accept_candidate',
  })
  assert.equal(nonActionable.ok, true)
  assert.equal(nonActionable.intake.proposeCandidate, false)
  assert.equal(nonActionable.intake.provenance.requestedAction, 'accept_candidate')
})

test('every actionable mapped kind that proposes a candidate is accepted by lifecycle.ts proposeCandidate() without throwing', () => {
  const scenarios = [
    { kind: 'capture', candidateSuggested: true, sourceSystem: 'chatgpt', requestedAction: 'none' },
    { kind: 'decision', candidateSuggested: true, sourceSystem: 'chatgpt', requestedAction: 'none' },
    { kind: 'decision', candidateSuggested: false, sourceSystem: 'human', requestedAction: 'accept_candidate' },
    {
      kind: 'final_artifact', candidateSuggested: true, sourceSystem: 'chatgpt', requestedAction: 'none',
      driveFileId: 'drive-file-1', digest: 'sha256:abc',
    },
    {
      kind: 'final_artifact', candidateSuggested: false, sourceSystem: 'human', requestedAction: 'accept_candidate',
      driveFileId: 'drive-file-1', digest: 'sha256:abc',
    },
  ]
  for (const overrides of scenarios) {
    const result = parse(overrides)
    assert.equal(result.ok, true, JSON.stringify(overrides))
    assert.equal(result.intake.proposeCandidate, true, JSON.stringify(overrides))
    assert.doesNotThrow(
      () => proposeCandidate({
        capture: result.intake.capture, proposedBy: 'test-suite', id: `cand-${overrides.kind}`, mode: 'digital',
      }),
      JSON.stringify(overrides),
    )
  }
})

test('accept_candidate from claude (AI) is rejected', () => {
  const result = parse({
    kind: 'decision',
    candidateSuggested: true,
    sourceSystem: 'claude',
    requestedAction: 'accept_candidate',
  })
  assert.deepEqual(result, { ok: false, code: 'ACCEPT_BY_AI_FORBIDDEN', field: 'sourceSystem' })
})

// ---- final_artifact with / without digest and driveFileId ----

test('final_artifact with both driveFileId and digest produces an artifact', () => {
  const result = parse({
    kind: 'final_artifact',
    driveFileId: 'drive-file-1',
    digest: 'sha256:abc',
    status: 'final',
  })
  assert.equal(result.ok, true)
  assert.notEqual(result.intake.artifact, null)
  assert.equal(result.intake.artifact.id, 'drive-file-1')
  assert.equal(result.intake.artifact.digest, 'sha256:abc')
  assert.equal(result.intake.artifact.state, 'confirmed')
})

test('final_artifact missing digest, driveFileId, or both produces no artifact', () => {
  const missingDigest = parse({ kind: 'final_artifact', driveFileId: 'drive-file-1' })
  assert.equal(missingDigest.ok, true)
  assert.equal(missingDigest.intake.artifact, null)

  const missingDriveFileId = parse({ kind: 'final_artifact', digest: 'sha256:abc' })
  assert.equal(missingDriveFileId.ok, true)
  assert.equal(missingDriveFileId.intake.artifact, null)

  const missingBoth = parse({ kind: 'final_artifact' })
  assert.equal(missingBoth.ok, true)
  assert.equal(missingBoth.intake.artifact, null)
})

test('a non final_artifact kind never produces an artifact, even with driveFileId and digest present', () => {
  const result = parse({ kind: 'decision', driveFileId: 'drive-file-1', digest: 'sha256:abc' })
  assert.equal(result.ok, true)
  assert.equal(result.intake.artifact, null)
})

// ---- status -> artifact state mapping ----

test('status maps to the artifact observation state', () => {
  const cases = [
    ['final', 'confirmed'],
    ['reviewed', 'unknown'],
    ['candidate', 'unknown'],
    ['informational', 'unknown'],
    ['superseded', 'stale'],
    ['archived', 'stale'],
  ]
  for (const [status, state] of cases) {
    const result = parse({ kind: 'final_artifact', driveFileId: 'drive-file-1', digest: 'sha256:abc', status })
    assert.equal(result.ok, true, status)
    assert.equal(result.intake.artifact.state, state, status)
  }
})

// ---- inference kept separate from statedText ----

test('inference is carried separately and never merged into statedText, evidenceRefs, or the artifact', () => {
  const result = parse({
    kind: 'final_artifact',
    driveFileId: 'drive-file-1',
    digest: 'sha256:abc',
    statedText: 'the actual statement',
    inference: 'an inferred conclusion',
    evidenceRefs: ['ev-1'],
  })
  assert.equal(result.ok, true)
  assert.equal(result.intake.capture.statedText, 'the actual statement')
  assert.equal(result.intake.inference, 'an inferred conclusion')
  assert.deepEqual(result.intake.capture.evidenceRefs, ['ev-1'])
  assert.equal(JSON.stringify(result.intake.artifact).includes('inferred conclusion'), false)
})

test('inference is null when absent', () => {
  const result = parse({})
  assert.equal(result.ok, true)
  assert.equal(result.intake.inference, null)
})

// ---- unknowns preserved verbatim ----

test('unknowns default to empty and are otherwise preserved verbatim, including duplicates and order', () => {
  const empty = parse({})
  assert.deepEqual(empty.intake.capture.unknowns, [])

  const withUnknowns = parse({ unknowns: ['b unresolved', 'a unresolved', 'b unresolved'] })
  assert.deepEqual(withUnknowns.intake.capture.unknowns, ['b unresolved', 'a unresolved', 'b unresolved'])
})

// ---- secret-like content, each pattern ----

test('every listed credential shape is rejected', () => {
  const secretSamples = [
    'AIzaSyD1234567890abcdefghijk',
    'sk-abcdefghijklmnopqrstuvwx',
    ['sk', 'live', '51H8xJ2eZvKYlo2CkAbCdEfGh'].join('_'),
    'ya29.a0Aabcdefghijklmnopqrst',
    ['AKIA', 'IOSFODNN7EXAMPLE'].join(''),
    '-----BEGIN PRIVATE KEY-----',
    'password=hunter2',
    'passwd=hunter2',
  ]
  for (const sample of secretSamples) {
    const result = parse({ statedText: `plain text ${sample} more text` })
    assert.equal(result.ok, false, sample)
    assert.equal(result.code, 'SECRET_LIKE_CONTENT', sample)
    assert.equal(result.field, 'statedText', sample)
  }
})

test('secret-like content in inference or notes is also rejected, with the offending field', () => {
  const viaInference = parse({ inference: 'leaked sk-abcdefghijklmnopqrstuvwx here' })
  assert.deepEqual(viaInference, { ok: false, code: 'SECRET_LIKE_CONTENT', field: 'inference' })

  const viaNotes = parse({ notes: 'leaked password=hunter2 here' })
  assert.deepEqual(viaNotes, { ok: false, code: 'SECRET_LIKE_CONTENT', field: 'notes' })
})

test('mid-word "sk-" false positives are accepted, real key-shaped tokens are still rejected', () => {
  const falsePositives = [
    'we finished task-1234567890 today',
    'sitting at the desk-9876543210 corner',
    'flagged as risk-4455667788 in the review',
  ]
  for (const sample of falsePositives) {
    const result = parse({ statedText: sample })
    assert.equal(result.ok, true, sample)
  }

  const stripeKey = parse({ statedText: `leaked ${['sk', 'live', '51H8xJ2eZvKYlo2CkAbCdEfGh'].join('_')} in the log` })
  assert.deepEqual(stripeKey, { ok: false, code: 'SECRET_LIKE_CONTENT', field: 'statedText' })

  const awsKey = parse({ statedText: `leaked ${['AKIA', 'IOSFODNN7EXAMPLE'].join('')} in the log` })
  assert.deepEqual(awsKey, { ok: false, code: 'SECRET_LIKE_CONTENT', field: 'statedText' })
})

// ---- unknown extra fields ignored ----

test('unknown extra fields on the input are ignored', () => {
  const result = parse({ someUnexpectedField: 'ignore me', anotherOne: 42 })
  assert.equal(result.ok, true)
  assert.equal(JSON.stringify(result.intake).includes('ignore me'), false)
})

// ---- wrong-type fields rejected ----

test('wrong-type fields fail closed with FIELD_INVALID and the offending field', () => {
  assert.deepEqual(parse({ sourceRefs: 'not-an-array' }), { ok: false, code: 'FIELD_INVALID', field: 'sourceRefs' })
  assert.deepEqual(parse({ evidenceRefs: [1, 2, 3] }), { ok: false, code: 'FIELD_INVALID', field: 'evidenceRefs' })
  assert.deepEqual(parse({ candidateSuggested: 'true' }), { ok: false, code: 'FIELD_INVALID', field: 'candidateSuggested' })
  assert.deepEqual(parse({ driveFileId: 123 }), { ok: false, code: 'FIELD_INVALID', field: 'driveFileId' })
  assert.deepEqual(parse({ digest: false }), { ok: false, code: 'FIELD_INVALID', field: 'digest' })
  assert.deepEqual(parse({ notes: 42 }), { ok: false, code: 'FIELD_INVALID', field: 'notes' })
  assert.deepEqual(parse({ unknowns: [{ not: 'a string' }] }), { ok: false, code: 'FIELD_INVALID', field: 'unknowns' })
  assert.deepEqual(parse({ requestedAction: 'delete-everything' }), { ok: false, code: 'FIELD_INVALID', field: 'requestedAction' })
})

test('empty-string or whitespace-only optional fields fail closed as FIELD_INVALID, not silently absent', () => {
  assert.deepEqual(
    parse({ kind: 'final_artifact', driveFileId: '', digest: 'sha256:abc' }),
    { ok: false, code: 'FIELD_INVALID', field: 'driveFileId' },
  )
  assert.deepEqual(
    parse({ kind: 'final_artifact', driveFileId: 'drive-file-1', digest: '   ' }),
    { ok: false, code: 'FIELD_INVALID', field: 'digest' },
  )
  assert.deepEqual(parse({ inference: '' }), { ok: false, code: 'FIELD_INVALID', field: 'inference' })
  assert.deepEqual(parse({ notes: '  ' }), { ok: false, code: 'FIELD_INVALID', field: 'notes' })
})

test('non-ISO-8601 timestamps fail closed as FIELD_INVALID', () => {
  assert.deepEqual(parse({ occurredAt: 'March 5, 2026' }), { ok: false, code: 'FIELD_INVALID', field: 'occurredAt' })
  assert.deepEqual(parse({ occurredAt: '03/05/2026' }), { ok: false, code: 'FIELD_INVALID', field: 'occurredAt' })
  assert.deepEqual(
    parseDorandoranHandoff(record(), { capturedBy: CONTEXT.capturedBy, capturedAt: 'March 5, 2026' }),
    { ok: false, code: 'FIELD_INVALID', field: 'capturedAt' },
  )
  assert.deepEqual(
    parseDorandoranHandoff(record(), { capturedBy: CONTEXT.capturedBy, capturedAt: '03/05/2026' }),
    { ok: false, code: 'FIELD_INVALID', field: 'capturedAt' },
  )
})

test('a non-object input fails closed with FIELD_MISSING', () => {
  assert.deepEqual(parseDorandoranHandoff(null, CONTEXT), { ok: false, code: 'FIELD_MISSING' })
  assert.deepEqual(parseDorandoranHandoff('a string', CONTEXT), { ok: false, code: 'FIELD_MISSING' })
  assert.deepEqual(parseDorandoranHandoff(['array'], CONTEXT), { ok: false, code: 'FIELD_MISSING' })
})

test('invalid context is rejected even when the record itself is otherwise valid', () => {
  assert.deepEqual(
    parseDorandoranHandoff(record(), { capturedBy: '', capturedAt: CONTEXT.capturedAt }),
    { ok: false, code: 'FIELD_INVALID', field: 'capturedBy' },
  )
  assert.deepEqual(
    parseDorandoranHandoff(record(), { capturedBy: CONTEXT.capturedBy, capturedAt: 'not-a-date' }),
    { ok: false, code: 'FIELD_INVALID', field: 'capturedAt' },
  )
})

// ---- integration with Unit 30 artifact registry ----

test('the produced artifact is accepted by buildArtifactRegistry', () => {
  const result = parse({
    kind: 'final_artifact',
    driveFileId: 'drive-file-1',
    digest: 'sha256:abc',
    status: 'final',
    evidenceRefs: ['ev-1'],
  })
  assert.equal(result.ok, true)
  const registry = buildArtifactRegistry([result.intake.artifact])
  assert.equal(registry.artifacts.length, 1)
  assert.equal(registry.artifacts[0].id, 'drive-file-1')
  assert.equal(registry.artifacts[0].digests[0], 'sha256:abc')
  assert.equal(registry.artifacts[0].state, 'confirmed')
  assert.deepEqual(registry.conflicts, [])
})

// ---- integration with Unit 28 validateCaptureWrite ----

test('the produced capture passes validateCaptureWrite for an adult own-lane session', () => {
  const result = parse(
    { person: 'jay', privacyScope: 'personal' },
    { capturedBy: 'jay', capturedAt: CONTEXT.capturedAt },
  )
  assert.equal(result.ok, true)
  const write = validateCaptureWrite({
    capture: result.intake.capture,
    session: { personId: 'jay', access: 'adult' },
    target: { personId: 'jay', access: 'adult' },
  })
  assert.deepEqual(write, { ok: true })
})
