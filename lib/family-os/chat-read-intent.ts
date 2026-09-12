const DETERMINISTIC_READ_TERMS = ['일정', '캘린더', '이번 주', '오늘', '후보', '승인', '할 일', 'task']

/**
 * 질문이 이미 화면의 확인된 read model로 답할 수 있는지 판정합니다.
 * 이런 질문은 외부 AI가 숫자나 날짜를 잘라 쓰더라도 운영판의 확정값을 훼손하지 않도록
 * 로컬 deterministic reply를 우선해야 합니다.
 */
export function isDeterministicChatReadRequest(input: string): boolean {
  const prompt = input.toLowerCase()
  return DETERMINISTIC_READ_TERMS.some((term) => prompt.includes(term))
}
