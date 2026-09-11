import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizationBearer,
  createApplePhotoDeviceToken,
  createApplePhotoPairingCode,
  deviceAuthSecret,
  hashApplePhotoDeviceSecret,
  parseApplePhotoDeviceToken,
} from '../../lib/server/apple-photo-device-auth.ts'

test('creates a one-time pairing code without exposing a fixed secret', () => {
  const first = createApplePhotoPairingCode()
  const second = createApplePhotoPairingCode()
  assert.match(first, /^dd_pair_v1\.[A-Za-z0-9_-]{32,}$/)
  assert.notEqual(first, second)
})

test('creates and parses a device token while hashing the stored value', () => {
  const issued = createApplePhotoDeviceToken('device-12345678')
  assert.deepEqual(parseApplePhotoDeviceToken(issued.token), { deviceId: 'device-12345678' })
  assert.equal(hashApplePhotoDeviceSecret(issued.token, 'secret-a'), hashApplePhotoDeviceSecret(issued.token, 'secret-a'))
  assert.notEqual(hashApplePhotoDeviceSecret(issued.token, 'secret-a'), hashApplePhotoDeviceSecret(issued.token, 'secret-b'))
  assert.equal(parseApplePhotoDeviceToken('dd_device_v1.bad.short'), null)
})

test('parses only a bearer authorization value and resolves the configured secret', () => {
  assert.equal(authorizationBearer('Bearer abc'), 'abc')
  assert.equal(authorizationBearer('Basic abc'), null)
  assert.equal(deviceAuthSecret({ DORANDORAN_AUTH_SECRET: 'fallback' }), 'fallback')
  assert.equal(deviceAuthSecret({ DORANDORAN_DEVICE_AUTH_SECRET: 'device-secret', DORANDORAN_AUTH_SECRET: 'fallback' }), 'device-secret')
})

