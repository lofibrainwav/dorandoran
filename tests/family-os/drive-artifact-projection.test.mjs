import test from 'node:test'
import assert from 'node:assert/strict'
import { projectDriveArtifacts } from '../../lib/family-os/drive-artifact-projection.ts'

test('projects only accepted artifacts and omits handoff text and digest', () => {
  const result = projectDriveArtifacts({
    entries: [
      { fileId: 'file-1', outcome: 'accepted', eventId: 'event-1', intake: {
        artifact: { id: 'artifact-1', kind: 'resume', digest: 'sha256:secret', observedAt: '2026-09-09T10:00:00Z', state: 'confirmed' },
        provenance: { sourceSystem: 'chatgpt', domain: 'career', sourceRefs: [] },
      } },
      { fileId: 'file-2', outcome: 'rejected', code: 'FIELD_INVALID' },
    ],
    skipped: [{ fileId: 'template', reason: 'template_file' }],
    unreadable: [], processedFileIds: [], processedEventIds: [],
  })

  assert.deepEqual(result.artifacts, [{
    id: 'artifact-1', kind: 'resume', observedAt: '2026-09-09T10:00:00Z', state: 'confirmed',
    sourceSystem: 'chatgpt', domain: 'career',
  }])
  assert.equal(result.accepted, 1)
  assert.equal(result.rejected, 1)
  assert.equal(JSON.stringify(result).includes('sha256:secret'), false)
})
