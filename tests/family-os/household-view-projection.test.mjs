import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseHouseholdMembership,
  parseResponsibilityOverrides,
  projectHouseholdTodayForViewer,
} from '../../lib/family-os/index.ts'

const membership = parseHouseholdMembership({
  DORANDORAN_HOUSEHOLD_MEMBERS_JSON: JSON.stringify([
    { personId: 'adult-transport', googleSub: 'sub-a', access: 'adult', roles: ['admin', 'transport'] },
    { personId: 'adult-scheduler', googleSub: 'sub-b', access: 'adult', roles: ['admin', 'scheduler'] },
    { personId: 'child-a', googleSub: 'sub-c', access: 'child', roles: ['child'] },
  ]),
})

const events = [
  {
    id: 'event-1', recurringEventId: 'series-1', subjectPersonId: 'child-a', title: 'Child activity',
    start: '2026-09-08T15:45:00-07:00', end: '2026-09-08T16:15:00-07:00', location: 'Scheduled place',
  },
  {
    id: 'event-2', recurringEventId: 'series-2', subjectPersonId: 'child-a', title: 'Later activity',
    start: '2026-09-08T17:00:00-07:00', end: '2026-09-08T18:00:00-07:00',
  },
]

test('transport adult sees action emphasis without changing schedule truth', () => {
  const view = projectHouseholdTodayForViewer({
    viewerPersonId: 'adult-transport', membership, events, overrides: [],
  })
  assert.equal(view.mode, 'execution')
  assert.deepEqual(view.items.map((item) => item.attention), ['action', 'action'])
  assert.equal(view.items[0].title, 'Child activity')
  assert.equal(view.items[0].start, '2026-09-08T15:45:00-07:00')
  assert.equal(view.items[0].location, 'Scheduled place')
  assert.equal(view.items[0].transportPersonId, 'adult-transport')
  assert.equal(view.items[0].schedulerPersonId, 'adult-scheduler')
})

test('scheduler adult sees manage emphasis over the same schedule facts', () => {
  const view = projectHouseholdTodayForViewer({
    viewerPersonId: 'adult-scheduler', membership, events, overrides: [],
  })
  assert.equal(view.mode, 'scheduling')
  assert.deepEqual(view.items.map((item) => item.attention), ['manage', 'manage'])
  assert.deepEqual(
    view.items.map(({ title, start, end, location }) => ({ title, start, end, location })),
    events.map(({ title, start, end, location }) => ({ title, start, end, location })),
  )
})

test('series responsibility override changes duty only, never event truth', () => {
  const overrides = parseResponsibilityOverrides({
    DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON: JSON.stringify([
      { kind: 'series', sourceId: 'series-1', responsibility: 'transport', personId: 'adult-scheduler' },
    ]),
  })
  const transportView = projectHouseholdTodayForViewer({
    viewerPersonId: 'adult-transport', membership, events, overrides,
  })
  const schedulerView = projectHouseholdTodayForViewer({
    viewerPersonId: 'adult-scheduler', membership, events, overrides,
  })

  assert.equal(transportView.items[0].attention, 'observe')
  assert.equal(schedulerView.items[0].attention, 'action')
  assert.equal(schedulerView.items[0].title, 'Child activity')
})

test('unknown viewer fails closed instead of receiving a role projection', () => {
  assert.throws(
    () => projectHouseholdTodayForViewer({ viewerPersonId: 'unknown', membership, events, overrides: [] }),
    /HOUSEHOLD_VIEWER_UNKNOWN/,
  )
})
