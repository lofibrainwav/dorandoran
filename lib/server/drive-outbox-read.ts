import { google } from 'googleapis'
import { runDriveOutboxIntake, type DriveOutboxRunResult } from '../family-os/drive-outbox-run.ts'
import { createDriveOutboxPorts, type DriveFilesClient } from './drive-outbox-ports.ts'
import { driveOutboxRuntimeHealth, resolveDriveOutboxRuntimeConfig } from './drive-outbox-runtime.ts'

export type DriveOutboxReadStatus = 'connected' | 'not_connected' | 'incomplete' | 'unavailable'

export interface DriveOutboxReadResult {
  status: DriveOutboxReadStatus
  lane: string
  result?: DriveOutboxRunResult
}

function decodeBody(data: unknown): unknown {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return data
}

/**
 * Server-only, read-only Drive Outbox projection. It never advances the cursor or mutates Drive.
 * Chat, Capsule, and future reconciler consumers must share this boundary.
 */
export async function readDriveOutbox(input: {
  env?: Record<string, string | undefined>
  lane: string
  capturedBy: string
  capturedAt: string
}): Promise<DriveOutboxReadResult> {
  const env = input.env ?? process.env
  const health = driveOutboxRuntimeHealth(env, input.lane)
  if (health === 'off') return { status: 'not_connected', lane: input.lane }
  if (health === 'incomplete') return { status: 'incomplete', lane: input.lane }

  try {
    const config = resolveDriveOutboxRuntimeConfig(env, input.lane)
    if (!config) return { status: 'not_connected', lane: input.lane }
    const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
    auth.setCredentials({ refresh_token: config.refreshToken })
    const drive = google.drive({ version: 'v3', auth })
    const client: DriveFilesClient = {
      list: async (params) => {
        const response = await drive.files.list({
          q: params.q, fields: params.fields, pageSize: params.pageSize,
          ...(params.pageToken ? { pageToken: params.pageToken } : {}),
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
      context: { capturedBy: input.capturedBy, capturedAt: input.capturedAt },
    })
    return { status: 'connected', lane: input.lane, result }
  } catch {
    return { status: 'unavailable', lane: input.lane }
  }
}
