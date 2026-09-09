import test from 'node:test'
import assert from 'node:assert/strict'

import {
  lifecycleTasksToPlannerWishes,
  mergePlannerWishes,
  LIFECYCLE_WISH_ID_PREFIX,
} from '../../lib/family-os/lifecycle-planner-bridge.ts'
import { buildFamilyPlanner, schedulePlannerWishes } from '../../lib/family-os/family-planner.ts'

function block(overrides = {}) {
  return {
    id: 'task-1',
    type: 'action',
    workMode: 'physical',
    reality: { title: 'Ride bikes', durationMinutes: 45 },
    evidenceRefs: ['ev-1'],
    evidenceState: 'unknown',
    people: { subjectIds: ['julie'], physicalOwnerIds: [], approverIds: ['julie'], recipientIds: [] },
    digital: { jobs: [] },
    timeEngine: { protected: false, priority: 'medium' },
    dependencyIds: [],
    childBlockIds: [],
    workState: 'open',
    ...overrides,
  }
}

function record(overrides = {}, blockOverrides = {}) {
  return {
    id: overrides.id ?? 'task-1',
    personId: overrides.personId ?? 'julie',
    block: block({ id: overrides.id ?? 'task-1', ...blockOverrides }),
  }
}

const viewer = { personId: 'julie' }

test('done, hold, 소요시간 없음 task는 제외된다', () => {
  const done = record({ id: 'task-done' }, { workState: 'done' })
  const hold = record({ id: 'task-hold' }, { workState: 'hold' })
  const noDuration = record({ id: 'task-no-duration' }, { reality: { title: '제목만' } })
  const open = record({ id: 'task-open' })

  const wishes = lifecycleTasksToPlannerWishes([done, hold, noDuration, open], viewer)

  assert.equal(wishes.length, 1)
  assert.equal(wishes[0].id, `${LIFECYCLE_WISH_ID_PREFIX}task-open`)
})

test('타인 lane의 task는 방어적으로 제외된다(본인 lane만)', () => {
  const ownTask = record({ id: 'task-own', personId: 'julie' })
  const otherLaneTask = record({ id: 'task-other', personId: 'jay' })

  const wishes = lifecycleTasksToPlannerWishes([ownTask, otherLaneTask], { personId: 'julie' })

  assert.equal(wishes.length, 1)
  assert.equal(wishes[0].id, `${LIFECYCLE_WISH_ID_PREFIX}task-own`)
})

test('lifecycle wish id는 task: 접두사로 네임스페이스되어 memo id와 충돌해도 둘 다 보존된다', () => {
  const lifecycleWishes = lifecycleTasksToPlannerWishes([record({ id: 'task-1' })], viewer)
  assert.equal(lifecycleWishes[0].id, 'task:task-1')

  // memo 쪽에서 우연히 똑같은 문자열 id('task:task-1')를 만들어낸 경우를 가정한다.
  const memoWishes = [{ id: 'task:task-1', title: '메모: 자전거', minutes: 20, estimated: false, required: false, owner: '함께' }]

  const merged = mergePlannerWishes(memoWishes, lifecycleWishes)

  assert.equal(merged.length, 2)
  const memoEntry = merged.find((wish) => wish.title === '메모: 자전거')
  const lifecycleEntry = merged.find((wish) => wish.title === 'Ride bikes')
  assert.ok(memoEntry, 'memo wish가 병합 결과에서 사라지면 안 된다')
  assert.ok(lifecycleEntry, 'lifecycle wish가 병합 결과에서 사라지면 안 된다')
  assert.equal(memoEntry.id, lifecycleEntry.id)
})

test('사용자가 조정한 소요시간(durations override)이 lifecycle wish에도 그대로 적용된다', () => {
  const lifecycleWishes = lifecycleTasksToPlannerWishes([record({ id: 'task-1' })], viewer)
  const merged = mergePlannerWishes([], lifecycleWishes)

  // components/family-planner.tsx의 `wishes` useMemo와 동일한 override 규칙:
  // saved.durations[wish.id] ?? wish.minutes
  const durations = { [`${LIFECYCLE_WISH_ID_PREFIX}task-1`]: 90 }
  const withOverride = merged.map((wish) => ({ ...wish, minutes: durations[wish.id] ?? wish.minutes }))

  assert.equal(merged[0].minutes, 45, '브릿지가 만든 원래 minutes는 block.reality.durationMinutes여야 한다')
  assert.equal(withOverride[0].minutes, 90, 'override는 lifecycle wish의 minutes를 덮어써야 한다')
})

test('priority가 high일 때만 required가 true다', () => {
  const highPriority = record({ id: 'task-high' }, { timeEngine: { protected: false, priority: 'high' } })
  const mediumPriority = record({ id: 'task-medium' }, { timeEngine: { protected: false, priority: 'medium' } })
  const noPriority = record({ id: 'task-none' }, { timeEngine: { protected: false } })

  const wishes = lifecycleTasksToPlannerWishes([highPriority, mediumPriority, noPriority], viewer)

  const byId = Object.fromEntries(wishes.map((wish) => [wish.id, wish]))
  assert.equal(byId['task:task-high'].required, true)
  assert.equal(byId['task:task-medium'].required, false)
  assert.equal(byId['task:task-none'].required, false)
})

test('병합된 lifecycle wish는 schedulePlannerWishes로 실제 빈 시간에 배치된다', () => {
  const input = { now: new Date('2026-09-08T15:00:00Z'), timeZone: 'America/Los_Angeles', known: true, childPersonId: 'child' }
  const model = buildFamilyPlanner({ ...input, observations: [] })

  const lifecycleWishes = lifecycleTasksToPlannerWishes([record({ id: 'task-1' })], viewer)
  const merged = mergePlannerWishes([], lifecycleWishes)

  const result = schedulePlannerWishes(merged, model)

  assert.equal(result.unplaced.length, 0)
  assert.equal(result.plans.length, 1)
  assert.equal(result.plans[0].title, 'Ride bikes')
  assert.equal(result.plans[0].minutes, 45)
  assert.equal(result.plans[0].owner, 'Julie')
})

test('hold 상태 task는 schedulePlannerWishes 배치 대상에도 오르지 않는다', () => {
  const input = { now: new Date('2026-09-08T15:00:00Z'), timeZone: 'America/Los_Angeles', known: true, childPersonId: 'child' }
  const model = buildFamilyPlanner({ ...input, observations: [] })

  const heldTask = record({ id: 'task-hold' }, { workState: 'hold' })
  const merged = mergePlannerWishes([], lifecycleTasksToPlannerWishes([heldTask], viewer))

  assert.equal(merged.length, 0)
  const result = schedulePlannerWishes(merged, model)
  assert.equal(result.plans.length, 0)
})
