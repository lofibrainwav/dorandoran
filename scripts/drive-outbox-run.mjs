#!/usr/bin/env node
/**
 * Drive Outbox local trigger (Unit 41).
 *
 * VERIFICATION LIMIT: this entry point has never completed a real Google round trip from this
 * repository. Everything it composes is tested (Units 33-40); this file is the untested seam
 * between those pieces and the actual Drive. Running it is how that changes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/drive-outbox-run.mjs --lane=10_JAY
 *
 * Read-only. Nothing here writes to Drive, and nothing here creates a Candidate or a Task.
 */
import { google } from 'googleapis'

import {
  driveOutboxRuntimeHealth,
  resolveDriveOutboxRuntimeConfig,
} from '../lib/server/drive-outbox-runtime.ts'
import { createDriveOutboxPorts } from '../lib/server/drive-outbox-ports.ts'
import { createPostgresDriveOutboxCursorStore } from '../lib/server/drive-outbox-cursor-store.ts'
import { runDriveOutboxSession } from '../lib/server/drive-outbox-session.ts'
import { resolvePostgresConnectionString } from '../lib/server/postgres-connection.ts'

const laneArg = process.argv.find((arg) => arg.startsWith('--lane='))
const lane = laneArg?.split('=').slice(1).join('=').trim()
if (!lane) throw new Error('DRIVE_OUTBOX_LANE_REQUIRED — pass --lane=<folder name>, e.g. --lane=10_JAY')

const health = driveOutboxRuntimeHealth(process.env, lane)
if (health === 'off') {
  process.stdout.write(`lane ${lane}: not configured (off). Nothing to do.\n`)
  process.exit(0)
}
// `incomplete` 는 여기서 throw 한다 — 절반 설정이 transport 깊은 곳에서 알 수 없는 실패가 되기 전에.
const config = resolveDriveOutboxRuntimeConfig(process.env, lane)

const connectionString = resolvePostgresConnectionString(process.env)
// 메모리 커서로 대체하지 않는다. 휘발 커서로 돌면 다음 실행이 outbox 전체를 다시 ingest 하고,
// 그것이 바로 Unit 39 가 막으려고 존재하는 상태다.
if (!connectionString) throw new Error('DRIVE_OUTBOX_DATABASE_REQUIRED — set DATABASE_URL; a volatile cursor re-ingests everything')

const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
auth.setCredentials({ refresh_token: config.refreshToken })
const drive = google.drive({ version: 'v3', auth })

/**
 * 아는 바이너리 표현만 명시적으로 UTF-8 디코드한다. `String(buffer)` 와 다르다 —
 * 그건 Unit 36 에게 그럴듯한 "[object Object]" 를 건네는 일이고, 여기서는 실제로 무엇인지
 * 아는 것만 바꾼다. 모르는 것은 그대로 두어 port 가 거부하게 한다.
 */
function decodeBody(data) {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return data
}

const client = {
  list: async (params) => drive.files.list(params),
  get: async (params) => {
    const response = await drive.files.get(params, { responseType: 'text' })
    return { data: decodeBody(response.data) }
  },
  export: async (params) => {
    const response = await drive.files.export(params, { responseType: 'text' })
    return { data: decodeBody(response.data) }
  },
}

const { Pool } = await import('pg')
const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000 })

try {
  const now = new Date().toISOString()
  const result = await runDriveOutboxSession({
    lane: config.lane,
    store: createPostgresDriveOutboxCursorStore({ query: (text, params) => pool.query(text, params) }),
    ports: createDriveOutboxPorts({ client, folderId: config.folderId }),
    context: { capturedBy: 'drive-outbox-trigger', capturedAt: now },
    now,
  })

  const counted = (outcome) => result.entries.filter((entry) => entry.outcome === outcome).length
  // 카운트만 찍는다. 레코드에는 statedText — 가족이 실제로 한 말 — 이 들어 있고,
  // 터미널·CI 로그·스크린샷은 아무도 그것을 두기로 결정한 적 없는 곳이다.
  process.stdout.write([
    `lane            ${result.lane}`,
    `accepted        ${counted('accepted')}`,
    `duplicate       ${counted('duplicate')}`,
    `rejected        ${counted('rejected')}`,
    `skipped         ${result.skipped.length}`,
    `unreadable      ${result.unreadable.length}`,
    `cursorAdvanced  ${result.cursorAdvanced}`,
    '',
  ].join('\n'))
} finally {
  await pool.end()
}
