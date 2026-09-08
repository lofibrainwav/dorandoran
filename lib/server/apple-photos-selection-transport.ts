import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface SelectedApplePhotoMetadata {
  id: string
  capturedAt?: string
  coordinates?: { latitude: number; longitude: number }
}

export type ApplePhotosScriptRunner = (script: string) => Promise<string>

function validCoordinates(value: unknown): { latitude: number; longitude: number } | undefined {
  if (!value || typeof value !== 'object') return undefined
  const point = value as { latitude?: unknown; longitude?: unknown }
  if (typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) return undefined
  if (typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) return undefined
  return { latitude: point.latitude, longitude: point.longitude }
}

function validDate(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? value.trim() : undefined
}

function requiredId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function selectionScript(limit: number): string {
  return `(() => {
  const app = Application('Photos')
  const items = app.selection()
  const count = Math.min(items.length, ${limit})
  const rows = []
  for (let index = 0; index < count; index += 1) {
    const item = items[index]
    const row = { id: String(item.id()) }
    try {
      const value = item.date()
      if (value) row.capturedAt = new Date(value).toISOString()
    } catch (_) {}
    try {
      const value = item.location()
      if (Array.isArray(value) && value.length >= 2) {
        const latitude = Number(value[0])
        const longitude = Number(value[1])
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) row.coordinates = { latitude, longitude }
      }
    } catch (_) {}
    rows.push(row)
  }
  return JSON.stringify(rows)
})()`
}

async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  })
  return stdout.trim()
}

export async function readSelectedApplePhotosMetadata(
  input: { limit: number },
  runner: ApplePhotosScriptRunner = runJxa,
): Promise<SelectedApplePhotoMetadata[]> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new Error('APPLE_PHOTOS_LIMIT_INVALID')
  }
  const raw = await runner(selectionScript(input.limit))
  const parsed: unknown = JSON.parse(raw || '[]')
  if (!Array.isArray(parsed)) throw new Error('APPLE_PHOTOS_PAYLOAD_INVALID')
  return parsed.slice(0, input.limit).flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const row = value as { id?: unknown; capturedAt?: unknown; coordinates?: unknown }
    const id = requiredId(row.id)
    if (!id) return []
    const capturedAt = validDate(row.capturedAt)
    const coordinates = validCoordinates(row.coordinates)
    return [{ id, ...(capturedAt ? { capturedAt } : {}), ...(coordinates ? { coordinates } : {}) }]
  })
}
