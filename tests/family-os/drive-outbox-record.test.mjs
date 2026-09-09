import test from 'node:test'
import assert from 'node:assert/strict'

import { parseOutboxRecordText } from '../../lib/family-os/drive-outbox-record.ts'
import { resolveGoogleReadOnlyScopes } from '../../lib/family-os/google-source-scopes.ts'
import { parseDorandoranHandoff } from '../../lib/family-os/drive-handoff-intake.ts'

// ---- scope wiring ----

test('drive read-only scope is resolvable', () => {
  assert.deepEqual(resolveGoogleReadOnlyScopes(['drive']), ['https://www.googleapis.com/auth/drive.readonly'])
})

test('existing services keep working and order follows the caller', () => {
  assert.deepEqual(resolveGoogleReadOnlyScopes(['drive', 'calendar']), [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ])
  assert.deepEqual(resolveGoogleReadOnlyScopes(['gmail']), ['https://www.googleapis.com/auth/gmail.readonly'])
})

test('an unsupported service still fails closed and names itself', () => {
  assert.throws(() => resolveGoogleReadOnlyScopes(['photos']), /GOOGLE_SOURCE_SERVICE_UNSUPPORTED:photos/)
  assert.throws(() => resolveGoogleReadOnlyScopes([]), /GOOGLE_SOURCE_SERVICE_REQUIRED/)
})

// ---- JSON payload ----

test('a JSON record is parsed as-is', () => {
  const text = JSON.stringify({ person: 'jay', kind: 'capture', statedText: 'stated', sourceRefs: ['a'] })
  assert.deepEqual(parseOutboxRecordText(text, { mimeType: 'application/json' }), {
    person: 'jay', kind: 'capture', statedText: 'stated', sourceRefs: ['a'],
  })
})

test('malformed JSON is reported, never silently retried as template text', () => {
  assert.throws(
    () => parseOutboxRecordText('{ person: jay', { mimeType: 'application/json' }),
    /INVALID_OUTBOX_RECORD_TEXT/,
  )
})

test('one file is one record — an array or scalar is refused', () => {
  for (const text of ['[{"person":"jay"}]', '"jay"', '42', 'null']) {
    assert.throws(() => parseOutboxRecordText(text, { mimeType: 'application/json' }), /INVALID_OUTBOX_RECORD_TEXT/)
  }
})

// ---- template text payload ----

const FILLED_TEMPLATE = `DORANDORAN HANDOFF TEMPLATE — AI INTEROP v1

Use this template when GPT, Gemini, Grok, Claude, JDK, KINGDOM, or another approved agent needs
to hand off a meaningful result to DoranDoran.

RULES
- Drive keeps the actual file/artifact bytes.
- AI may create Capture/Candidate only.

HANDOFF RECORD

eventId: evt-2026-09-09-0415
occurredAt: 2026-09-09T04:15:00.000Z
person: jay
domain: kingdom
kind: capture
statedText: friction metric needs a second axis
sourceRefs:
- drive:1abcDEF
- chat:2026-09-09
evidenceRefs:
- drive:1abcDEF
unknowns:
candidateSuggested: true
requestedAction: review

POLICY METADATA
privacyScope: personal
status: candidate
sourceSystem: claude

LAST UPDATED: 2026-09-09
`

test('a filled template yields exactly the known fields', () => {
  const record = parseOutboxRecordText(FILLED_TEMPLATE, { mimeType: 'application/vnd.google-apps.document' })
  assert.equal(record.eventId, 'evt-2026-09-09-0415')
  assert.equal(record.person, 'jay')
  assert.equal(record.kind, 'capture')
  assert.equal(record.statedText, 'friction metric needs a second axis')
  assert.equal(record.privacyScope, 'personal')
  assert.equal(record.sourceSystem, 'claude')
  assert.deepEqual(record.sourceRefs, ['drive:1abcDEF', 'chat:2026-09-09'])
  assert.deepEqual(record.evidenceRefs, ['drive:1abcDEF'])
})

test('prose and section headers never become fields', () => {
  const record = parseOutboxRecordText(FILLED_TEMPLATE, { mimeType: 'text/plain' })
  assert.equal('LAST UPDATED' in record, false)
  assert.equal('RULES' in record, false)
  assert.equal('POLICY METADATA' in record, false)
  assert.equal('Use this template when GPT, Gemini, Grok, Claude, JDK, KINGDOM, or another approved agent needs' in record, false)
})

test('a list key with no items is an empty array, not a missing field', () => {
  const record = parseOutboxRecordText(FILLED_TEMPLATE, { mimeType: 'text/plain' })
  assert.deepEqual(record.unknowns, [])
})

test('candidateSuggested becomes a boolean; anything else is left for Unit 31 to reject', () => {
  const yes = parseOutboxRecordText('person: jay\ncandidateSuggested: TRUE\n', { mimeType: 'text/plain' })
  assert.equal(yes.candidateSuggested, true)
  const no = parseOutboxRecordText('person: jay\ncandidateSuggested: false\n', { mimeType: 'text/plain' })
  assert.equal(no.candidateSuggested, false)
  const junk = parseOutboxRecordText('person: jay\ncandidateSuggested: maybe\n', { mimeType: 'text/plain' })
  assert.equal(junk.candidateSuggested, 'maybe')
})

test('an untouched placeholder is dropped rather than passed on as a stated value', () => {
  const record = parseOutboxRecordText('person: jay\nstatedText: <what the human/source actually stated>\n', { mimeType: 'text/plain' })
  assert.equal('statedText' in record, false)
  assert.equal(record.person, 'jay')
})

test('text with no known field is refused — an empty result is not an empty record', () => {
  for (const text of ['', '   \n\n', 'RULES\n- nothing here\n', 'LAST UPDATED: 2026-09-09\n']) {
    assert.throws(() => parseOutboxRecordText(text, { mimeType: 'text/plain' }), /INVALID_OUTBOX_RECORD_TEXT/)
  }
})

// ---- end to end with Unit 31 ----

test('a filled template flows through Unit 31 into a CaptureEvent', () => {
  const record = parseOutboxRecordText(FILLED_TEMPLATE, { mimeType: 'application/vnd.google-apps.document' })
  const result = parseDorandoranHandoff(record, {
    capturedBy: 'dorandoran-outbox',
    capturedAt: '2026-09-09T08:00:00.000Z',
  })
  assert.equal(result.ok, true)
  assert.equal(result.intake.capture.id, 'evt-2026-09-09-0415')
  assert.equal(result.intake.capture.statedText, 'friction metric needs a second axis')
  assert.equal(result.intake.capture.source, 'system')
  assert.equal(result.intake.proposeCandidate, true)
})
