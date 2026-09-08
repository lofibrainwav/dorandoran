import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFamilyPlanner, canPlaceTimebox, exportTimeboxes, parsePlannerMemo, schedulePlannerWishes } from '../../lib/family-os/family-planner.ts'

const input = { now: new Date('2026-09-08T15:00:00Z'), timeZone: 'America/Los_Angeles', known: true, childPersonId: 'child' }
const obs = (start, end, id = 'private-id') => ({ id, kind: 'schedule', evidenceState: 'confirmed', sourceRef: 'private-source', evidenceRefs: ['private-evidence'], sixW1H: { when: { start, end }, what: { label: 'Practice' }, who: { personIds: ['child'] } } })

test('rest survives time-band boundaries and explicit durations are never shortened', () => {
  const model = buildFamilyPlanner({ ...input, observations: [] })
  const existing = [{ id: 'prior', title: 'Prior', date: '2026-09-08', startMinute: 480, minutes: 240, owner: 'Together' }]
  const result = schedulePlannerWishes(parsePlannerMemo('Next 30분'), model, existing)
  assert.equal(result.plans[0].startMinute, 730)
  assert.equal(parsePlannerMemo('Long 20시간')[0].minutes, 1200)
  assert.equal(parsePlannerMemo('@제이든 읽기')[0].owner, '제이든')
})

test('planner preserves every overlapping date, protects 15-minute buffers, and strips identifiers', () => {
  const model = buildFamilyPlanner({ ...input, observations: [obs('2026-09-08T10:00:00-07:00', '2026-09-08T11:00:00-07:00')] })
  const day = model.days[2]
  assert.equal(day.events.length, 1)
  assert.ok(day.gaps.every((gap) => gap.endMinute <= 585 || gap.startMinute >= 675))
  assert.ok(day.gaps.every((gap) => gap.startMinute >= 480))
  assert.equal(model.days[0].gaps.length, 0)
  assert.doesNotMatch(JSON.stringify(model), /private-id|private-source|private-evidence/)
})

test('unknown sources and all-day constraints do not become availability claims', () => {
  assert.ok(buildFamilyPlanner({ ...input, known: false, observations: [] }).days.every((day) => !day.gaps.length))
  const model = buildFamilyPlanner({ ...input, observations: [obs('2026-09-08', '2026-09-10')] })
  assert.equal(model.days[2].gaps.length, 0)
  assert.equal(model.days[3].events.length, 1)
  assert.equal(model.days[4].events.length, 0)
  assert.equal(model.eventCount, 1)
})

test('overlaps and narrow gaps are schedule warnings without inventing travel times', () => {
  const model = buildFamilyPlanner({ ...input, observations: [obs('2026-09-08T10:00:00-07:00', '2026-09-08T11:00:00-07:00'), obs('2026-09-08T10:45:00-07:00', '2026-09-08T11:30:00-07:00', 'second')] })
  assert.deepEqual(model.days[2].notices, [{ kind: 'overlap', minutes: 15 }])
})

test('draft placement rejects conflicts and oversized tasks; calendar export escapes content', () => {
  const gap = { date: '2026-09-08', startMinute: 720, endMinute: 780, minutes: 60 }
  const plan = { id: 'local-1', title: 'Read, then rest\nBEGIN:bad', date: gap.date, startMinute: 720, minutes: 30, owner: 'Together' }
  assert.equal(canPlaceTimebox(gap, 90, []), false)
  assert.equal(canPlaceTimebox(gap, 30, [plan]), false)
  assert.equal(canPlaceTimebox(gap, 30, []), true)
  const ics = exportTimeboxes([plan], input.timeZone)
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20260908T120000/)
  assert.ok(ics.includes('SUMMARY:Read\\, then rest\\nBEGIN:bad'))
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1)
})

test('freeform wishes keep explicit duration, flag estimates, and auto-place must-do work before wants', () => {
  const wishes = parsePlannerMemo('가족 산책 30분\n해야 할 준비 1시간 15분\n책 읽기')
  assert.deepEqual(wishes.map((wish) => wish.minutes), [30, 75, 30])
  assert.deepEqual(wishes.map((wish) => wish.estimated), [false, false, true])
  const model = buildFamilyPlanner({ ...input, observations: [obs('2026-09-08T10:00:00-07:00', '2026-09-08T11:00:00-07:00')] })
  const result = schedulePlannerWishes(wishes, model)
  assert.equal(result.plans.length, 3)
  assert.equal(result.plans[0].title, wishes[1].title)
  for (const plan of result.plans) {
    assert.ok(model.days.flatMap((day) => day.gaps).some((gap) => gap.date === plan.date && plan.startMinute >= gap.startMinute && plan.startMinute + plan.minutes <= gap.endMinute))
  }
  assert.equal(schedulePlannerWishes(wishes, { ...model, known: false }).plans.length, 0)
})
