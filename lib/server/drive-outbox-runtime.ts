/**
 * Unit 41 — Drive Outbox runtime configuration.
 *
 * Pure environment resolution, split from the executable trigger the way
 * `resolveGoogleCalendarWebRuntimeConfig` is split from `google-calendar-smoke.mjs`. Keeping this
 * half pure means a misconfiguration is caught by a test rather than by a failed round trip
 * against someone's real Drive.
 */

export interface DriveOutboxRuntimeConfig {
  lane: string
  clientId: string
  clientSecret: string
  refreshToken: string
  folderId: string
}

export type DriveOutboxRuntimeHealth = 'off' | 'incomplete' | 'ready'

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * lane 이름 → 폴더 env 키. `google-calendar-smoke.mjs` 의 source key 정규화와 같은 규칙이라
 * 두 lane 체계가 서로 다른 이름 규칙을 갖지 않는다.
 */
export function driveOutboxLaneEnvKey(lane: string): string {
  if (typeof lane !== 'string' || lane.trim() === '') throw new Error('DRIVE_OUTBOX_LANE_REQUIRED')
  return `DRIVE_OUTBOX_FOLDER_${lane.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`
}

// main 은 파일 경로가 아니라 env 의 refresh token 으로 Google 에 붙는다
// (google-calendar-web-transport 와 같은 방식). Vercel 배포 표면에는 읽을 파일이 없다.
function rawValues(env: Record<string, string | undefined>, lane: string) {
  return {
    clientId: clean(env.DRIVE_OUTBOX_CLIENT_ID),
    clientSecret: clean(env.DRIVE_OUTBOX_CLIENT_SECRET),
    refreshToken: clean(env.DRIVE_OUTBOX_REFRESH_TOKEN),
    folderId: clean(env[driveOutboxLaneEnvKey(lane)]),
  }
}

/**
 * 설정 여부를 boolean 하나로 말하지 않는다 — "설치 안 됨" 과 "잘못 설치됨" 은 다른 사건이고,
 * 절반만 설정된 상태가 transport 호출 깊은 곳에서 알 수 없는 실패를 만든다.
 */
export function driveOutboxRuntimeHealth(
  env: Record<string, string | undefined>,
  lane: string,
): DriveOutboxRuntimeHealth {
  const values = rawValues(env, lane)
  const inputs = [values.clientId, values.clientSecret, values.refreshToken, values.folderId]
  if (!inputs.some(Boolean)) return 'off'
  return inputs.every(Boolean) ? 'ready' : 'incomplete'
}

export function resolveDriveOutboxRuntimeConfig(
  env: Record<string, string | undefined>,
  lane: string,
): DriveOutboxRuntimeConfig | null {
  const health = driveOutboxRuntimeHealth(env, lane)
  // 설정되지 않은 lane 은 오류가 아니다 — 그저 이 lane 을 쓰지 않는 것이다.
  if (health === 'off') return null
  if (health === 'incomplete') throw new Error('INCOMPLETE_DRIVE_OUTBOX_CONFIG')

  const values = rawValues(env, lane)
  return {
    lane: lane.trim(),
    clientId: values.clientId as string,
    clientSecret: values.clientSecret as string,
    refreshToken: values.refreshToken as string,
    folderId: values.folderId as string,
  }
}
