import test from 'node:test'
import assert from 'node:assert/strict'
import { createLanguageBridge } from '../../lib/family-os/index.ts'

test('translation preserves source reference and keeps reply separate', () => {
  const result = createLanguageBridge({
    sourceLanguage: 'en',
    preferredLanguage: 'ko',
    sourceTextRef: 'gmail:message-1',
    translatedMeaning: '수업 장소가 변경됩니다.',
    extractedActions: ['새 장소 확인'],
    extractedDeadlines: [],
    uncertainties: [],
    communicationProfileRef: 'profile:parent-1',
    generatedReply: 'Thank you for the update.',
    sourceText: 'This must not be copied into the projection.',
  })
  assert.equal(result.sourceTextRef, 'gmail:message-1')
  assert.equal(result.translatedMeaning, '수업 장소가 변경됩니다.')
  assert.equal(result.generatedReply, 'Thank you for the update.')
  assert.equal('sourceText' in result, false)
})
test('missing source reference fails closed', () => {
  assert.throws(() => createLanguageBridge({
    sourceLanguage: 'en',
    preferredLanguage: 'ko',
    sourceTextRef: '   ',
    translatedMeaning: '의미',
  }), /SOURCE_TEXT_REF_REQUIRED/)
})

test('translation remains useful without generating an external reply', () => {
  const result = createLanguageBridge({
    sourceLanguage: 'en',
    preferredLanguage: 'ko',
    sourceTextRef: 'file:notice-1',
    translatedMeaning: '내일까지 양식을 제출해야 합니다.',
    extractedActions: ['양식 제출'],
    extractedDeadlines: ['tomorrow'],
  })
  assert.equal(result.generatedReply, undefined)
  assert.deepEqual(result.extractedActions, ['양식 제출'])
})