// Pure, DOM-free mapping from a lifecycle API error code to a short Korean message. Kept out of
// the component so it is directly unit-testable and so no raw error code is ever rendered without
// its Korean explanation next to it (the component always renders `message` and `code` together).

export interface LifecycleErrorDisplay {
  code: string
  message: string
}

const LIFECYCLE_ERROR_MESSAGES: Record<string, string> = {
  LANE_MISMATCH: '이 lane에는 적을 수 없습니다',
  PRIVACY_SCOPE_DENIED: '이 범위는 허용되지 않습니다',
  BODY_INVALID: '입력을 확인해 주세요',
  AUTH_REQUIRED: '다시 로그인해 주세요',
  ORIGIN_DENIED: '요청 출처가 확인되지 않았습니다',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었습니다 — 새로고침',
  LIFECYCLE_STORE_UNAVAILABLE: '저장소에 연결할 수 없습니다',
}

export const LIFECYCLE_ERROR_DEFAULT_MESSAGE = '처리할 수 없습니다'

/** Every code the spec requires a mapping for — used by tests to assert full coverage. */
export const LIFECYCLE_ERROR_CODES = Object.keys(LIFECYCLE_ERROR_MESSAGES)

/** Never returns the raw code alone — always pairs it with a Korean message, falling back to a
 * generic one for any code this UI does not specifically recognize. */
export function lifecycleErrorMessage(code: string): LifecycleErrorDisplay {
  return { code, message: LIFECYCLE_ERROR_MESSAGES[code] ?? LIFECYCLE_ERROR_DEFAULT_MESSAGE }
}
