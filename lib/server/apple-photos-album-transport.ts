import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SelectedApplePhotoMetadata } from './apple-photos-selection-transport.ts'

const execFileAsync = promisify(execFile)
const OSXPHOTOS_VERSION = '0.76.1'

export type ApplePhotosAlbumRunner = (command: string, args: string[]) => Promise<string>

function optionalDate(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value))
    ? value.trim() : undefined
}

function optionalCoordinates(value: unknown): { latitude: number; longitude: number } | undefined {
  if (!value || typeof value !== 'object') return undefined
  const point = value as { latitude?: unknown; longitude?: unknown }
  if (typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) return undefined
  if (typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) return undefined
  return { latitude: point.latitude, longitude: point.longitude }
}

function sanitizeRows(parsed: unknown, limit: number): SelectedApplePhotoMetadata[] {
  if (!Array.isArray(parsed)) throw new Error('APPLE_PHOTOS_ALBUM_PAYLOAD_INVALID')
  return parsed.slice(0, limit).flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const row = value as { id?: unknown; capturedAt?: unknown; coordinates?: unknown }
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : undefined
    if (!id) return []
    const capturedAt = optionalDate(row.capturedAt)
    const coordinates = optionalCoordinates(row.coordinates)
    return [{ id, ...(capturedAt ? { capturedAt } : {}), ...(coordinates ? { coordinates } : {}) }]
  })
}

const pythonScript = String.raw`
import contextlib, io, json, osxphotos, sys
album_name = sys.argv[1]
limit = int(sys.argv[2])
with contextlib.redirect_stdout(io.StringIO()):
    db = osxphotos.PhotosDB()
    album_exists = any(album.title == album_name for album in db.album_info)
    photos = db.photos(albums=[album_name])[:limit] if album_exists else []
rows = []
for photo in photos:
    row = {"id": photo.uuid}
    if photo.date:
        row["capturedAt"] = photo.date.isoformat()
    lat, lon = photo.location
    if lat is not None and lon is not None:
        row["coordinates"] = {"latitude": lat, "longitude": lon}
    rows.append(row)
print(json.dumps({"albumExists": album_exists, "rows": rows}))
`

async function runAlbumQuery(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: 45_000,
    maxBuffer: 1024 * 1024,
  })
  return stdout.trim()
}

export async function readApplePhotosAlbumMetadata(
  input: { albumName: string; limit: number },
  runner: ApplePhotosAlbumRunner = runAlbumQuery,
): Promise<SelectedApplePhotoMetadata[]> {
  const albumName = input.albumName.trim()
  if (!albumName) throw new Error('APPLE_PHOTOS_ALBUM_NAME_REQUIRED')
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new Error('APPLE_PHOTOS_LIMIT_INVALID')
  const command = process.env.UV_BIN?.trim() || 'uv'
  const args = ['run', '--with', `osxphotos==${OSXPHOTOS_VERSION}`, '--python', '3.12', 'python', '-c', pythonScript, albumName, String(input.limit)]
  const raw = await runner(command, args)
  const parsed: unknown = JSON.parse(raw || '[]')
  if (Array.isArray(parsed)) return sanitizeRows(parsed, input.limit)
  if (!parsed || typeof parsed !== 'object') throw new Error('APPLE_PHOTOS_ALBUM_PAYLOAD_INVALID')
  const payload = parsed as { albumExists?: unknown; rows?: unknown }
  if (payload.albumExists === false) throw new Error('APPLE_PHOTOS_ALBUM_NOT_FOUND')
  if (payload.albumExists !== true) throw new Error('APPLE_PHOTOS_ALBUM_PAYLOAD_INVALID')
  return sanitizeRows(payload.rows, input.limit)
}
