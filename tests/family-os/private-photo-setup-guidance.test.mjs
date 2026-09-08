import test from 'node:test'
import assert from 'node:assert/strict'
import { projectPrivatePhotoSetupGuidance } from '../../lib/server/private-photo-setup-guidance.ts'

function result(overrides = {}) {
  return {
    source: 'apple-photos-album',
    sourceHealth: 'green',
    selectedCount: 0,
    sourceState: 'ready',
    experience: { clusters: [], stories: [], unlocatedMemoryCount: 0, ungroupedMemoryCount: 0 },
    ...overrides,
  }
}

test('no private photo source yields no setup guidance', () => {
  assert.equal(projectPrivatePhotoSetupGuidance(null, { albumName: 'DoranDoran' }), null)
})

test('missing album is action-required, not ready', () => {
  const guidance = projectPrivatePhotoSetupGuidance(
    result({ sourceHealth: 'partial', sourceState: 'album-missing' }),
    { albumName: 'DoranDoran' },
  )
  assert.equal(guidance.state, 'action-required')
  assert.equal(guidance.action, 'create-designated-album')
  assert.match(guidance.detail, /DoranDoran/)
})

test('transport failure stays failure', () => {
  const guidance = projectPrivatePhotoSetupGuidance(
    result({ sourceHealth: 'failure', sourceState: 'failure' }),
    { albumName: 'DoranDoran' },
  )
  assert.equal(guidance.state, 'failure')
  assert.equal(guidance.action, 'check-photo-source')
})

test('ready empty album is valid and distinct from missing', () => {
  const guidance = projectPrivatePhotoSetupGuidance(result(), { albumName: 'DoranDoran' })
  assert.equal(guidance.state, 'ready')
  assert.equal(guidance.action, null)
  assert.match(guidance.detail, /0 memories/)
})

test('guidance never exposes canonical/private evidence fields', () => {
  const guidance = projectPrivatePhotoSetupGuidance(result({ selectedCount: 3 }), { albumName: 'DoranDoran' })
  const json = JSON.stringify(guidance)
  for (const forbidden of ['evidenceRef', 'sourceRef', 'asset-', '/Users/', 'token']) {
    assert.equal(json.includes(forbidden), false, `leaked ${forbidden}`)
  }
})
