import test from 'node:test'
import assert from 'node:assert/strict'

import { selectScheduleResult } from '../../lib/server/schedule-result-selection.ts'

test('healthy operational calendar wins over the local fallback', () => {
  const op = { sourceHealth: 'green', id: 'op' }
  const local = { sourceHealth: 'green', id: 'local' }
  assert.equal(selectScheduleResult(op, local).id, 'op')
})

test('a failed operational read falls back to a healthy local source instead of hiding it', () => {
  const op = { sourceHealth: 'failure', id: 'op' }
  const local = { sourceHealth: 'green', id: 'local' }
  assert.equal(selectScheduleResult(op, local).id, 'local')
  assert.equal(selectScheduleResult(op, null).id, 'op')
  assert.equal(selectScheduleResult(null, null), null)
})
