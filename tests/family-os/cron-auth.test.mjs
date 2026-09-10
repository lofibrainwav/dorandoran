import assert from 'node:assert/strict'
import test from 'node:test'
import { isCronAuthorized } from '../../lib/server/cron-auth.ts'

test('cron auth accepts only the exact bearer secret', () => {
  assert.equal(isCronAuthorized({ authorization: 'Bearer nightly-secret', secret: 'nightly-secret' }), true)
  assert.equal(isCronAuthorized({ authorization: 'nightly-secret', secret: 'nightly-secret' }), false)
  assert.equal(isCronAuthorized({ authorization: 'Bearer wrong', secret: 'nightly-secret' }), false)
  assert.equal(isCronAuthorized({ authorization: 'Bearer nightly-secret', secret: undefined }), false)
  assert.equal(isCronAuthorized({ authorization: 'Bearer nightly-secret', secret: '   ' }), false)
})
