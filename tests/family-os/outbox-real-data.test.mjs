import test from 'node:test'
import assert from 'node:assert/strict'

import { parseOutboxRecordText } from '../../lib/family-os/drive-outbox-record.ts'
import { parseDorandoranHandoff } from '../../lib/family-os/drive-handoff-intake.ts'
import { planDriveOutboxIntake } from '../../lib/family-os/drive-outbox-intake.ts'

/**
 * 2026-09-09 에 실제 Drive 의 10_JAY/04_DORANDORAN_OUTBOX 에서 읽은 본문 그대로.
 * 손으로 지어낸 픽스처가 아니라 관측된 것이다 — 이 유닛의 모든 수정이 여기서 나왔다.
 */
const REAL_TEMPLATE = [
  'DORANDORAN HANDOFF TEMPLATE — AI INTEROP v1',
  '',
  'RULES',
  '',
  '\\- Drive keeps the actual file/artifact bytes.',
  '',
  '\\- kind=final\\_artifact requires digest: sha256:\\<hex\\>; without it, Artifact Registry entry is prohibited.',
  '',
  'HANDOFF RECORD',
  '',
  'person: \\<jay | julie | jayden | family\\>',
  '',
  'kind: \\<capture | candidate | decision | task | learning\\_event | final\\_artifact\\>',
  '',
  'statedText: \\<what the human/source actually stated\\>',
  '',
  'sourceRefs:',
  '',
  '\\- \\<stable source references\\>',
  '',
  'unknowns:',
  '',
  '\\- \\<anything not known\\>',
  '',
  'POLICY METADATA',
  '',
  'privacyScope: \\<personal | family | professional\\>',
  '',
  'EXAMPLE',
  '',
  'person: jay',
  '',
  'kind: final\\_artifact',
  '',
  'statedText: \\<final artifact statement\\>',
  '',
  'unknowns: \\[\\]',
  '',
  'privacyScope: personal',
  '',
  'digest: sha256:\\<hex\\>',
  '',
  'LAST UPDATED: 2026-09-09',
  '',
].join('\n')

/** 다른 Drive 클라이언트는 이스케이프 없이 줄 수 있다. 어느 쪽이든 같아야 한다. */
const UNESCAPED_TEMPLATE = REAL_TEMPLATE.replace(/\\([-<>_[\]])/g, '$1')

// ---- 1. 템플릿 파일은 레코드가 아니다 ----

test('the handoff template file is skipped before it is ever read', () => {
  const plan = planDriveOutboxIntake({
    files: [{
      fileId: 'tpl-1',
      name: 'DORANDORAN_HANDOFF_TEMPLATE',
      modifiedTime: '2026-09-09T17:33:50.000Z',
      mimeType: 'application/vnd.google-apps.document',
    }],
  })
  assert.deepEqual(plan.fetch, [])
  assert.deepEqual(plan.skipped, [{ fileId: 'tpl-1', reason: 'template_file' }])
})

test('template detection ignores case and surrounding decoration', () => {
  const names = ['dorandoran_handoff_template', 'DORANDORAN_HANDOFF_TEMPLATE.md', 'Copy of DORANDORAN_HANDOFF_TEMPLATE']
  for (const name of names) {
    const plan = planDriveOutboxIntake({
      files: [{ fileId: 'f', name, modifiedTime: '2026-09-09T17:33:50.000Z', mimeType: 'text/plain' }],
    })
    assert.deepEqual(plan.skipped, [{ fileId: 'f', reason: 'template_file' }], name)
  }
})

test('a real record whose name merely mentions handoff is not skipped', () => {
  const plan = planDriveOutboxIntake({
    files: [{ fileId: 'f', name: '20260909-jay-handoff.md', modifiedTime: '2026-09-09T17:33:50.000Z', mimeType: 'text/markdown' }],
  })
  assert.deepEqual(plan.fetch.map((entry) => entry.fileId), ['f'])
})

// ---- 2·3·4. 실제 본문이 남긴 것들 ----

for (const [label, text] of [['escaped', REAL_TEMPLATE], ['unescaped', UNESCAPED_TEMPLATE]]) {
  test(`the real template yields no scaffolding as content (${label})`, () => {
    const record = parseOutboxRecordText(text, { mimeType: 'application/vnd.google-apps.document' })

    // 이스케이프됐든 아니든 플레이스홀더는 값이 아니다.
    assert.equal('statedText' in record, false, 'statedText placeholder leaked')
    // kind 는 EXAMPLE 에 실제 리터럴이 있다(person·privacyScope 와 같은 성격) — 남는 것이 정상이고,
    // 이스케이프는 전송 아티팩트이지 내용이 아니므로 풀린 형태여야 한다.
    assert.equal(record.kind, 'final_artifact')
    // sha256:<hex> 는 접두어가 붙은 플레이스홀더다.
    assert.equal('digest' in record, false, 'prefixed placeholder leaked')
    // [] 는 "없음" 의 표기이지 항목이 아니다.
    assert.deepEqual(record.unknowns, [])
    assert.deepEqual(record.sourceRefs, [])
    // EXAMPLE 의 리터럴 두 개만 남는다.
    assert.equal(record.person, 'jay')
    assert.equal(record.privacyScope, 'personal')
  })

  test(`the real template is still rejected by Unit 31 (${label})`, () => {
    const record = parseOutboxRecordText(text, { mimeType: 'application/vnd.google-apps.document' })
    const result = parseDorandoranHandoff(record, { capturedBy: 'probe', capturedAt: '2026-09-09T20:00:00.000Z' })
    assert.equal(result.ok, false)
  })
}

// ---- first-write-wins ----

test('a filled field is not overwritten by a later specimen of the same field', () => {
  const text = [
    'HANDOFF RECORD',
    'person: julie',
    'statedText: the real thing she said',
    '',
    'EXAMPLE',
    'person: jay',
    'statedText: <final artifact statement>',
  ].join('\n')
  const record = parseOutboxRecordText(text, { mimeType: 'text/plain' })
  assert.equal(record.person, 'julie')
  assert.equal(record.statedText, 'the real thing she said')
})
