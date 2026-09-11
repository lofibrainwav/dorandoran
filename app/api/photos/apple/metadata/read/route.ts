import type { NextRequest } from 'next/server'
import { resolveLifecycleContext } from '@/lib/server/lifecycle-runtime'
import { loadApplePhotoMetadataProjection } from '@/lib/server/apple-photo-metadata-read'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }

/** Returns only the display projection; cloud IDs and evidence refs never cross this boundary. */
export async function GET(request: NextRequest) {
  const context = await resolveLifecycleContext(request)
  if ('error' in context) return Response.json({ error: context.error }, { status: context.error === 'AUTH_REQUIRED' ? 401 : 503, headers })
  const projection = await loadApplePhotoMetadataProjection({ now: new Date(), maxAgeMs: 24 * 60 * 60 * 1000 })
  return Response.json({
    status: projection.status,
    lastSyncedAt: projection.lastSyncedAt,
    selectedCount: projection.selectedCount,
    experience: projection.experience,
  }, { status: 200, headers })
}
