// A5 "Planner 브릿지": 사람이 수락한 Task(Accepted Task)를 /family OneBox 시간표 planner의
// PlannerWish로 합류시키는 순수 함수. DOM 없음 — UI(components/family-planner.tsx)가 fetch로
// 받아온 데이터를 이 함수들에 넘기기만 한다. 새 API·새 enum·새 의존성은 추가하지 않는다.

import type { FamilyBlock } from './contracts.ts'
import { taskToPlannerWish } from './lifecycle.ts'
import type { PlannerWish } from './family-planner.ts'

/**
 * `/api/lifecycle/tasks?person=` 응답 한 건이 이 브릿지에 필요로 하는 최소 형태.
 * 서버의 `TaskRecord`(lib/server/lifecycle-store.ts)와 필드 이름이 반드시 같아야 하지만,
 * 순수 lib 파일에서 lib/server를 import하지 않기 위해(레이어 경계) 여기서 좁게 다시 선언한다.
 */
export interface LifecycleTaskForPlanner {
  id: string
  personId: string
  block: FamilyBlock
}

/** memo wish id(`wish-0` 등)와 절대 충돌하지 않도록 lifecycle 유래 wish id에 붙이는 네임스페이스. */
export const LIFECYCLE_WISH_ID_PREFIX = 'task:'

/** `person`(Task의 lane 소유자) 라벨을 표시용으로 다듬는다. 원본 personId('julie')는 그대로
 * PlannerWish.owner에 들어가는 대신, 메모 wish의 owner 표기('Julie' 등)와 결을 맞춘다. */
function displayOwner(personId: string): string {
  return personId ? personId.charAt(0).toUpperCase() + personId.slice(1) : personId
}

/**
 * 사람이 수락한 Task 중 시간 배치 대상이 되는 것만 PlannerWish로 변환한다.
 *
 * 제외 규칙:
 * - done / 소요시간(durationMinutes) 없음 / owner(subjectIds[0]) 없음
 *   → A1의 `taskToPlannerWish`가 이미 null을 반환한다. 여기서 재구현하지 않는다.
 * - hold(보류) 상태
 *   → `taskToPlannerWish`는 hold를 걸러내지 않으므로 이 함수가 명시적으로 제외한다. 보류는
 *     "지금은 시간에 넣지 않기로" 사람이 정한 상태이므로, 자동 배치(`schedulePlannerWishes`)가
 *     빈 시간에 밀어 넣어버리면 그 결정과 정면으로 어긋난다. 보류가 풀려 다시 open이 되면
 *     다음 fetch에서 자연히 다시 후보가 된다.
 *
 * Privacy(본인 lane만):
 * - 호출자는 `/api/lifecycle/tasks?person={viewer.personId}` — 즉 viewer 본인 lane만 — 을 fetch해
 *   `tasks`로 넘겨야 한다(서버의 읽기-권한 경계 ②가 1차 방어선).
 * - 이 함수는 그 위에 `task.personId !== viewer.personId`인 항목을 방어적으로 한 번 더 걸러낸다
 *   (fail-closed 이중 방어). 호출자가 실수로 다른 lane이 섞인 배열을 넘기더라도, 예를 들어 Julie의
 *   professional 업무가 가족 시간표(OneBox)에 새어 나오는 일이 없도록 하기 위해서다.
 *
 * id 네임스페이스:
 * - 반환하는 wish의 id는 항상 `task:{taskId}` 형태다. memo가 만드는 id(`wish-0`, `wish-1`, …)와
 *   절대 겹치지 않게 해서, ICS export·계획 삭제처럼 id로 동작하는 로직이 서로 다른 출처의 wish를
 *   같은 것으로 착각하지 않게 한다.
 */
export function lifecycleTasksToPlannerWishes(
  tasks: LifecycleTaskForPlanner[],
  viewer: { personId: string },
): PlannerWish[] {
  const wishes: PlannerWish[] = []
  for (const task of tasks) {
    if (task.personId !== viewer.personId) continue
    if (task.block.workState === 'hold') continue
    const wish = taskToPlannerWish(task.block)
    if (!wish) continue
    wishes.push({ ...wish, id: `${LIFECYCLE_WISH_ID_PREFIX}${wish.id}`, owner: displayOwner(wish.owner) })
  }
  return wishes
}

/**
 * memo wish와 lifecycle wish를 합친다. id가 우연히 겹치더라도 하나를 밀어내지 않고 — lifecycle을
 * 우선하지 않고 — 둘 다 그대로 남긴다(단순 이어붙이기). `lifecycleTasksToPlannerWishes`가 이미
 * `task:` 접두사로 네임스페이스했으므로 memo id(`wish-N`)와 애초에 충돌하지 않지만, 이 함수 자체는
 * 그 전제 없이도 "둘 다 보존"이라는 계약을 지킨다.
 */
export function mergePlannerWishes(memoWishes: PlannerWish[], lifecycleWishes: PlannerWish[]): PlannerWish[] {
  return [...memoWishes, ...lifecycleWishes]
}
