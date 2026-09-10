/**
 * Chat에서 Planner로 넘길 수 있는 명시적 배치 요청만 식별한다.
 * 일정 조회 질문은 여기서 통과시키지 않으며, 외부 Calendar 변경도 수행하지 않는다.
 */
export function isPlannerSchedulingRequest(input: string): boolean {
  const value = input.trim().toLowerCase()
  if (!value) return false
  return /(?:일정|시간표|스케줄|캘린더).*(?:잡아|넣어|배치|짜줘|만들어)|(?:잡아|넣어|배치해|배치해줘|짜줘|만들어줘)/i.test(value)
}

/** Planner memo의 기존 줄을 보존하면서 같은 요청은 한 번만 제안한다. */
export function appendPlannerChatProposal(existing: string, request: string): string {
  const proposal = request.trim()
  if (!proposal) throw new Error('CHAT_PLANNER_REQUEST_REQUIRED')
  const lines = existing.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.some((line) => line === proposal)) return lines.join('\n')
  return [...lines, proposal].join('\n')
}
