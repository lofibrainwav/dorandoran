/**
 * Unit 36 — Drive Outbox record parsing. Turns the *text* of an outbox file into the object
 * Unit 31 validates. Pure and deterministic: no network, no OAuth, no persistence.
 *
 * This unit performs no validation of field values. That is Unit 31's job; duplicating it here
 * would give the contract two places to drift.
 */

/** Exactly the fields Unit 31 knows. Anything else in the file is prose, not a record. */
const KNOWN_FIELDS: readonly string[] = [
  'eventId', 'occurredAt', 'person', 'domain', 'kind', 'privacyScope', 'status', 'sourceSystem',
  'sourceRefs', 'driveFileId', 'digest', 'evidenceRefs', 'statedText', 'inference', 'unknowns',
  'candidateSuggested', 'requestedAction', 'notes',
]

const LIST_FIELDS: readonly string[] = ['sourceRefs', 'evidenceRefs', 'unknowns']

const FIELD_LINE = /^\\?-?\s*([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/
const LIST_ITEM_LINE = /^\\?-\s*(.*)$/

/**
 * Drive 는 본문을 마크다운 이스케이프해서 돌려주기도 한다 — 2026-09-09 실측에서
 * `\<jay | julie\>` · `final\_artifact` · `\[\]` 형태로 왔다. 이스케이프는 전송 아티팩트이지
 * 내용이 아니므로 판정 전에 풀고, 푼 값을 저장한다. 그대로 두면 Unit 31 이 enum 불일치로
 * 거부하는데 그것은 우연한 방어이지 정직한 판정이 아니다.
 */
function unescapeMarkdown(value: string): string {
  return value.replace(/\\([-<>_[\]])/g, '$1')
}

/**
 * 손대지 않은 템플릿 슬롯. 값 **전체**가 `<...>` 인 경우만 보던 것을, 푼 뒤 `<...>` 를 **포함**하면
 * 플레이스홀더로 본다 — 실측에서 `sha256:<hex>` 처럼 접두어 붙은 슬롯이 값으로 통과했다.
 */
function isPlaceholder(value: string): boolean {
  return /<[^<>]*>/.test(unescapeMarkdown(value))
}

/** `[]` 는 "없음" 의 표기이지 항목이 아니다. 실측에서 `unknowns: \[\]` 가 항목 하나가 됐다. */
function isEmptyListNotation(value: string): boolean {
  return unescapeMarkdown(value).trim() === '[]'
}

function isKnownField(name: string): boolean {
  return KNOWN_FIELDS.includes(name)
}

function isListField(name: string): boolean {
  return LIST_FIELDS.includes(name)
}

/**
 * `candidateSuggested` 만 형변환한다. Unit 31 계약이 boolean 으로 명확하기 때문이다.
 * true/false 가 아닌 값은 바꾸지 않고 그대로 넘겨 Unit 31 이 FIELD_INVALID 로 거부하게 둔다 —
 * 여기서 추측하면 거부되어야 할 입력이 조용히 통과한다.
 */
function coerceScalar(field: string, value: string): unknown {
  if (field !== 'candidateSuggested') return value
  const lowered = value.trim().toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  return value
}

/**
 * Template text → record.
 *
 * 화이트리스트로 읽는 이유: 템플릿 파일에는 레코드 말고도 설명문·섹션 헤더·`LAST UPDATED: 2026-09-09`
 * 같은 줄이 함께 있다. 순진한 `key: value` 훑기는 그 날짜를 필드로 들어올리고, 보낸 사람이 쓴
 * 콜론 있는 문장 하나가 또 다른 필드가 된다.
 */
function parseTemplateText(text: string): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const lines = text.split(/\r?\n/)
  let openList: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (openList !== null) {
      const item = LIST_ITEM_LINE.exec(line)
      if (item) {
        const value = item[1].trim()
        if (value !== '' && !isPlaceholder(value) && !isEmptyListNotation(value)) {
          ;(record[openList] as string[]).push(unescapeMarkdown(value))
        }
        continue
      }
      // 리스트는 다음 필드나 비어있지 않은 다른 줄에서 끝난다. 항목이 없었으면 빈 배열로 남는다.
      if (line !== '') openList = null
    }

    const matched = FIELD_LINE.exec(line)
    if (!matched) continue
    const [, field, rawValue] = matched
    if (!isKnownField(field)) continue

    // 먼저 쓴 쪽이 이긴다. 템플릿은 같은 필드를 두 번 적는다 — 위는 채우라고 둔 자리,
    // 아래 EXAMPLE 은 견본이다. HANDOFF RECORD 가 앞이므로 보낸 사람이 채운 것이 남고
    // 그 아래 견본이 덮지 못한다.
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      openList = null
      continue
    }

    const value = rawValue.trim()

    if (isListField(field)) {
      record[field] = []
      openList = field
      if (value !== '' && !isPlaceholder(value) && !isEmptyListNotation(value)) {
        ;(record[field] as string[]).push(unescapeMarkdown(value))
      }
      continue
    }

    if (value === '' || isPlaceholder(value)) continue
    record[field] = coerceScalar(field, unescapeMarkdown(value))
  }

  return record
}

function parseJsonText(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // JSON 이라고 선언하고 틀린 것은 알려야 한다 — 템플릿 파서로 조용히 되돌리면 무엇이 틀렸는지 사라진다.
    throw new Error('INVALID_OUTBOX_RECORD_TEXT')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    // 파일 하나에 레코드 하나.
    throw new Error('INVALID_OUTBOX_RECORD_TEXT')
  }
  return parsed as Record<string, unknown>
}

/**
 * Outbox 파일 본문 → 레코드 객체.
 *
 * JSON(README 의 canonical handoff 블록)과 채워진 템플릿 텍스트 둘 다 정당한 발신 형식이라 둘 다 읽는다.
 */
export function parseOutboxRecordText(
  text: string,
  options: { mimeType: string },
): Record<string, unknown> {
  if (typeof text !== 'string') throw new Error('INVALID_OUTBOX_RECORD_TEXT')
  const trimmed = text.trim()
  if (trimmed === '') throw new Error('INVALID_OUTBOX_RECORD_TEXT')

  if (options.mimeType === 'application/json' || trimmed.startsWith('{')) {
    return parseJsonText(trimmed)
  }

  const record = parseTemplateText(text)
  // 아무 필드도 못 읽은 것은 빈 레코드가 아니라 레코드가 아닌 것이다.
  if (Object.keys(record).length === 0) throw new Error('INVALID_OUTBOX_RECORD_TEXT')
  return record
}
