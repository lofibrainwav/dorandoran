import { google } from 'googleapis'
import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '@/lib/family-os/google-household-identity'
import { runDriveOutboxIntake } from '@/lib/family-os/drive-outbox-run'
import { projectDriveArtifacts } from '@/lib/family-os/drive-artifact-projection'
import { createDriveOutboxPorts, type DriveFilesClient } from '@/lib/server/drive-outbox-ports'
import { driveOutboxRuntimeHealth, resolveDriveOutboxRuntimeConfig } from '@/lib/server/drive-outbox-runtime'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' }
const DEFAULT_LANE = '10_JAY'
const ALLOWED_LANES = new Set(['00_DORANDORAN_FAMILY', '10_JAY', '20_SHARED_PROJECTS'])

function decodeBody(data: unknown): unknown {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return data
}

/** Read-only Drive projection for Doran Chat. It never advances the outbox cursor. */
export async function GET(request: NextRequest) {
  try {
    const membership = parseHouseholdMembership(process.env)
    const member = await resolveHouseholdSessionMember(
      request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value,
      process.env.DORANDORAN_AUTH_SECRET ?? '',
      membership,
      Date.now(),
    )
    if (!member) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers })

    const requestedLane = request.nextUrl.searchParams.get('lane')?.trim() || DEFAULT_LANE
    if (!ALLOWED_LANES.has(requestedLane)) {
      return Response.json({ error: 'DRIVE_OUTBOX_LANE_NOT_ALLOWED' }, { status: 400, headers })
    }

    const health = driveOutboxRuntimeHealth(process.env, requestedLane)
    if (health === 'off') return Response.json({ status: 'not_connected', lane: requestedLane, artifacts: [] }, { headers })
    if (health === 'incomplete') return Response.json({ status: 'incomplete', lane: requestedLane, artifacts: [] }, { status: 503, headers })

    const config = resolveDriveOutboxRuntimeConfig(process.env, requestedLane)
    if (!config) return Response.json({ status: 'not_connected', lane: requestedLane, artifacts: [] }, { headers })

    const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
    auth.setCredentials({ refresh_token: config.refreshToken })
    const drive = google.drive({ version: 'v3', auth })
    const client: DriveFilesClient = {
      list: async (params) => {
        const response = await drive.files.list({
          q: params.q, fields: params.fields, pageSize: params.pageSize, ...(params.pageToken ? { pageToken: params.pageToken } : {}),
        })
        return { data: { files: response.data.files as unknown[] | undefined, nextPageToken: response.data.nextPageToken ?? undefined } }
      },
      get: async (params) => {
        const response = await drive.files.get({ fileId: params.fileId, alt: params.alt }, { responseType: 'text' })
        return { data: decodeBody(response.data) }
      },
      export: async (params) => {
        const response = await drive.files.export({ fileId: params.fileId, mimeType: params.mimeType }, { responseType: 'text' })
        return { data: decodeBody(response.data) }
      },
    }
    const result = await runDriveOutboxIntake({
      ports: createDriveOutboxPorts({ client, folderId: config.folderId }),
      context: { capturedBy: `doran-chat:${member.personId}`, capturedAt: new Date().toISOString() },
    })
    return Response.json({ status: 'connected', lane: requestedLane, ...projectDriveArtifacts(result) }, { headers })
  } catch {
    return Response.json({ status: 'unavailable', artifacts: [] }, { status: 503, headers })
  }
}
