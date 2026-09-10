import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { privateFamilySurfaceEnabled } from './private-family-surface.ts'
import {
  loadPrivatePhotoJourney,
  type PrivatePhotoJourneyResult,
} from './private-photo-journey-source.ts'

const SNAPSHOT_VERSION = 1

type SnapshotStatus = 'fresh' | 'stale' | 'missing' | 'invalid' | 'disabled'

export interface PrivatePhotoSnapshotRead {
  status: SnapshotStatus
  generatedAt: string | null
  result: PrivatePhotoJourneyResult | null
}

type PhotoSourceLoader = typeof loadPrivatePhotoJourney

function configuredPath(env: Record<string, string | undefined>): string | null {
  const value = env.CHAD_PRIVATE_PHOTO_SNAPSHOT_PATH?.trim()
  return value || null
}

function finiteCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  return value
}

function safeString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  return value.trim()
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined
}

function safeCoordinates(value: unknown): { latitude: number; longitude: number } {
  if (!value || typeof value !== 'object') throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  const point = value as { latitude?: unknown; longitude?: unknown }
  if (typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  }
  if (typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  }
  return { latitude: point.latitude, longitude: point.longitude }
}

function sanitizeExperience(value: unknown): PrivatePhotoJourneyResult['experience'] {
  if (!value || typeof value !== 'object') throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  const input = value as PrivatePhotoJourneyResult['experience']
  if (!Array.isArray(input.clusters) || !Array.isArray(input.stories)) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  const clusters = input.clusters.map((cluster) => ({
    id: safeString(cluster.id),
    label: safeString(cluster.label),
    coordinates: safeCoordinates(cluster.coordinates),
    memoryCount: finiteCount(cluster.memoryCount),
    ...(optionalDate(cluster.firstSeen) ? { firstSeen: optionalDate(cluster.firstSeen) } : {}),
    ...(optionalDate(cluster.lastSeen) ? { lastSeen: optionalDate(cluster.lastSeen) } : {}),
  }))
  const stories = input.stories.map((story) => ({
    id: safeString(story.id),
    start: safeString(story.start),
    end: safeString(story.end),
    memoryCount: finiteCount(story.memoryCount),
    places: Array.isArray(story.places) ? story.places.map(safeString) : (() => { throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID') })(),
    summary: safeString(story.summary),
  }))
  return {
    clusters,
    stories,
    unlocatedMemoryCount: finiteCount(input.unlocatedMemoryCount),
    ungroupedMemoryCount: finiteCount(input.ungroupedMemoryCount),
  }
}

export function sanitizePrivatePhotoJourneyResult(value: unknown): PrivatePhotoJourneyResult {
  if (!value || typeof value !== 'object') throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  const input = value as PrivatePhotoJourneyResult
  if (!['apple-photos-selection', 'apple-photos-album'].includes(input.source)) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  if (!['green', 'partial', 'failure'].includes(input.sourceHealth)) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  if (!['ready', 'album-missing', 'failure'].includes(input.sourceState)) throw new Error('PHOTO_SNAPSHOT_RESULT_INVALID')
  return {
    source: input.source,
    sourceHealth: input.sourceHealth,
    selectedCount: finiteCount(input.selectedCount),
    sourceState: input.sourceState,
    experience: sanitizeExperience(input.experience),
  }
}

export async function refreshPrivatePhotoSnapshot(input: {
  env?: Record<string, string | undefined>
  observedAt: string
  maxGapMs: number
  loadSource?: PhotoSourceLoader
}): Promise<PrivatePhotoSnapshotRead> {
  const env = input.env ?? process.env
  if (!privateFamilySurfaceEnabled(env)) return { status: 'disabled', generatedAt: null, result: null }
  const snapshotPath = configuredPath(env)
  if (!snapshotPath) throw new Error('PHOTO_SNAPSHOT_PATH_REQUIRED')
  const source = await (input.loadSource ?? loadPrivatePhotoJourney)({
    env, observedAt: input.observedAt, maxGapMs: input.maxGapMs,
  })
  if (!source) throw new Error('PHOTO_SNAPSHOT_SOURCE_DISABLED')
  const result = sanitizePrivatePhotoJourneyResult(source)
  const payload = { version: SNAPSHOT_VERSION, generatedAt: input.observedAt, result }
  await mkdir(dirname(snapshotPath), { recursive: true })
  const tempPath = `${snapshotPath}.tmp-${process.pid}`
  await writeFile(tempPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(tempPath, snapshotPath)
  return { status: 'fresh', generatedAt: input.observedAt, result }
}

export async function loadPrivatePhotoSnapshot(input: {
  env?: Record<string, string | undefined>
  now: Date
  maxAgeMs: number
}): Promise<PrivatePhotoSnapshotRead> {
  const env = input.env ?? process.env
  if (!privateFamilySurfaceEnabled(env)) return { status: 'disabled', generatedAt: null, result: null }
  if (!Number.isFinite(input.maxAgeMs) || input.maxAgeMs <= 0) throw new Error('PHOTO_SNAPSHOT_MAX_AGE_INVALID')
  const snapshotPath = configuredPath(env)
  if (!snapshotPath) return { status: 'missing', generatedAt: null, result: null }
  let raw: string
  try {
    raw = await readFile(/* turbopackIgnore: true */ snapshotPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing', generatedAt: null, result: null }
    return { status: 'invalid', generatedAt: null, result: null }
  }
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; generatedAt?: unknown; result?: unknown }
    if (parsed.version !== SNAPSHOT_VERSION || typeof parsed.generatedAt !== 'string') throw new Error('PHOTO_SNAPSHOT_INVALID')
    const generatedMs = Date.parse(parsed.generatedAt)
    if (!Number.isFinite(generatedMs)) throw new Error('PHOTO_SNAPSHOT_INVALID')
    const ageMs = input.now.getTime() - generatedMs
    if (!Number.isFinite(ageMs) || ageMs < 0) throw new Error('PHOTO_SNAPSHOT_INVALID')
    if (ageMs > input.maxAgeMs) return { status: 'stale', generatedAt: parsed.generatedAt, result: null }
    return {
      status: 'fresh',
      generatedAt: parsed.generatedAt,
      result: sanitizePrivatePhotoJourneyResult(parsed.result),
    }
  } catch {
    return { status: 'invalid', generatedAt: null, result: null }
  }
}
