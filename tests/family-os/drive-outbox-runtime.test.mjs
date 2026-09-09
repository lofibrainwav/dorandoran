import test from 'node:test'
import assert from 'node:assert/strict'

import {
  driveOutboxRuntimeHealth,
  resolveDriveOutboxRuntimeConfig,
  driveOutboxLaneEnvKey,
} from '../../lib/server/drive-outbox-runtime.ts'

const LANE = '10_JAY'

function env(overrides = {}) {
  return {
    DRIVE_OUTBOX_CLIENT_ID: 'client-id',
    DRIVE_OUTBOX_CLIENT_SECRET: 'client-secret',
    DRIVE_OUTBOX_REFRESH_TOKEN: 'refresh-token',
    DRIVE_OUTBOX_FOLDER_10_JAY: 'folder-jay',
    ...overrides,
  }
}

// ---- lane key normalization ----

test('a lane name becomes a stable env key', () => {
  assert.equal(driveOutboxLaneEnvKey('10_JAY'), 'DRIVE_OUTBOX_FOLDER_10_JAY')
  assert.equal(driveOutboxLaneEnvKey('00_DORANDORAN_FAMILY'), 'DRIVE_OUTBOX_FOLDER_00_DORANDORAN_FAMILY')
  assert.equal(driveOutboxLaneEnvKey('20-shared projects'), 'DRIVE_OUTBOX_FOLDER_20_SHARED_PROJECTS')
})

test('a blank lane fails closed', () => {
  for (const lane of ['', '   ']) {
    assert.throws(() => driveOutboxLaneEnvKey(lane), /DRIVE_OUTBOX_LANE_REQUIRED/)
    assert.throws(() => driveOutboxRuntimeHealth(env(), lane), /DRIVE_OUTBOX_LANE_REQUIRED/)
  }
})

// ---- health ----

test('nothing configured is off, not an error', () => {
  assert.equal(driveOutboxRuntimeHealth({}, LANE), 'off')
  assert.equal(resolveDriveOutboxRuntimeConfig({}, LANE), null)
})

test('everything configured is ready', () => {
  assert.equal(driveOutboxRuntimeHealth(env(), LANE), 'ready')
})

test('half a configuration is incomplete, and resolving it throws', () => {
  const partials = [
    { DRIVE_OUTBOX_CLIENT_ID: 'client-id' },
    { DRIVE_OUTBOX_REFRESH_TOKEN: 'refresh-token' },
    { DRIVE_OUTBOX_FOLDER_10_JAY: 'folder-jay' },
    env({ DRIVE_OUTBOX_REFRESH_TOKEN: undefined }),
    env({ DRIVE_OUTBOX_FOLDER_10_JAY: '   ' }),
  ]
  for (const partial of partials) {
    assert.equal(driveOutboxRuntimeHealth(partial, LANE), 'incomplete', JSON.stringify(partial))
    assert.throws(() => resolveDriveOutboxRuntimeConfig(partial, LANE), /INCOMPLETE_DRIVE_OUTBOX_CONFIG/)
  }
})

test('another lane being configured does not make this lane ready', () => {
  const other = {
    DRIVE_OUTBOX_CLIENT_ID: 'client-id',
    DRIVE_OUTBOX_CLIENT_SECRET: 'client-secret',
    DRIVE_OUTBOX_REFRESH_TOKEN: 'refresh-token',
    DRIVE_OUTBOX_FOLDER_00_DORANDORAN_FAMILY: 'folder-family',
  }
  assert.equal(driveOutboxRuntimeHealth(other, '10_JAY'), 'incomplete')
  assert.equal(driveOutboxRuntimeHealth(other, '00_DORANDORAN_FAMILY'), 'ready')
})

// ---- resolve ----

test('a ready config resolves to trimmed values and the lane it was asked for', () => {
  const config = resolveDriveOutboxRuntimeConfig(
    env({ DRIVE_OUTBOX_FOLDER_10_JAY: '  folder-jay  ' }),
    LANE,
  )
  assert.deepEqual(config, {
    lane: '10_JAY',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token',
    folderId: 'folder-jay',
  })
})
