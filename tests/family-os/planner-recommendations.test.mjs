import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFamilyPlanner } from '../../lib/family-os/family-planner.ts'
import { recommendPlannerWishes } from '../../lib/family-os/planner-recommendations.ts'

const base = { now: new Date('2026-09-08T15:00:00Z'), timeZone: 'America/Los_Angeles', known: true, childPersonId: 'child', observations: [] }
const wish = (id, title, minutes, required = false) => ({ id, title, minutes, estimated: false, required, owner: 'Together' })

test('recommendations keep only wishes that fit a current planner gap', () => {
  const model = buildFamilyPlanner(base)
  const result = recommendPlannerWishes([wish('fit', '산책', 30), wish('too-long', '긴 프로젝트', 5000)], model)
  assert.deepEqual(result.map((item) => item.wishId), ['fit'])
  assert.equal(result[0].title, '산책')
  assert.equal(result[0].owner, 'Together')
  assert.ok(result[0].fitReason.includes('TIME_FITS'))
  assert.equal(result[0].frictionReason.length, 0)
})

test('recommendations preserve priority and duration overrides through the existing ranker', () => {
  const model = buildFamilyPlanner(base)
  const result = recommendPlannerWishes([wish('want', '하고 싶은 일', 30), wish('must', '해야 할 일', 45, true)], model)
  assert.deepEqual(result.map((item) => item.wishId), ['must', 'want'])
  assert.ok(result[0].fitReason.includes('HIGH_PRIORITY'))
})

test('recommendations are capped at three and carry the existing option contract', () => {
  const model = buildFamilyPlanner(base)
  const result = recommendPlannerWishes(Array.from({ length: 5 }, (_, index) => wish(`wish-${index}`, `일 ${index}`, 20)), model)
  assert.equal(result.length, 3)
  assert.deepEqual(Object.keys(result[0]).sort(), ['confidence', 'fitReason', 'frictionReason', 'label', 'owner', 'title', 'wishId'])
})

test('unknown or empty planner models produce no recommendations', () => {
  const known = buildFamilyPlanner(base)
  assert.deepEqual(recommendPlannerWishes([wish('one', '일', 20)], { ...known, known: false }), [])
  assert.deepEqual(recommendPlannerWishes([wish('one', '일', 20)], { ...known, days: [] }), [])
})
