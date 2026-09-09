import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { redactConnectionStrings } from '../../scripts/migrate.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptPath = path.join(repoRoot, 'scripts', 'migrate.mjs')

test('scripts/migrate.mjs refuses to run with neither DATABASE_URL nor POSTGRES_URL set', () => {
  const { env: parentEnv } = process
  const env = { ...parentEnv }
  delete env.DATABASE_URL
  delete env.POSTGRES_URL

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  })

  assert.equal(result.status, 2)
  assert.ok(!result.stderr.includes('postgres://'), 'stderr must never print a connection string')
  assert.ok(!result.stdout.includes('postgres://'), 'stdout must never print a connection string')
  assert.match(result.stderr, /DATABASE_URL|POSTGRES_URL/)
})

test('redactConnectionStrings strips credentials and the postgres(ql)?:// prefix from a message', () => {
  const message = 'connect failed: postgres://user:secret@invalid.invalid:1/db is unreachable'
  const redacted = redactConnectionStrings(message)
  assert.ok(!redacted.includes('secret'))
  assert.ok(!redacted.includes('postgres://user'))
  assert.match(redacted, /connect failed: postgres:\/\/\[redacted\] is unreachable/)
})

test('scripts/migrate.mjs never leaks a connection string (or its credentials) when the connection fails', () => {
  // "invalid.invalid" is a reserved TLD (RFC 2606) guaranteed never to resolve, so this fails
  // fast via DNS/connect error without ever touching a real database.
  const env = { ...process.env, DATABASE_URL: 'postgres://user:secret@invalid.invalid:1/db' }
  delete env.POSTGRES_URL

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 15_000,
  })

  assert.notEqual(result.status, 0)
  assert.ok(!result.stderr.includes('secret'), 'stderr must never print connection-string credentials')
  assert.ok(!result.stderr.includes('postgres://'), 'stderr must never print a connection string')
  assert.ok(!result.stdout.includes('secret'), 'stdout must never print connection-string credentials')
  assert.ok(!result.stdout.includes('postgres://'), 'stdout must never print a connection string')
})
