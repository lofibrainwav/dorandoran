import { refreshPrivatePhotoSnapshot } from '../lib/server/private-photo-snapshot.ts'

const startedAt = Date.now()
const observedAt = new Date().toISOString()

try {
  const snapshot = await refreshPrivatePhotoSnapshot({
    observedAt,
    maxGapMs: 36 * 60 * 60 * 1000,
  })
  console.log(JSON.stringify({
    status: snapshot.status,
    sourceHealth: snapshot.result?.sourceHealth ?? null,
    sourceState: snapshot.result?.sourceState ?? null,
    memoryCount: snapshot.result?.selectedCount ?? 0,
    clusterCount: snapshot.result?.experience.clusters.length ?? 0,
    storyCount: snapshot.result?.experience.stories.length ?? 0,
    elapsedMs: Date.now() - startedAt,
  }))
} catch (error) {
  console.error(JSON.stringify({
    status: 'failure',
    error: error instanceof Error ? error.message : 'unknown',
    elapsedMs: Date.now() - startedAt,
  }))
  process.exitCode = 1
}
