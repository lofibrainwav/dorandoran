import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolvePostgresConnectionString } from '../lib/server/postgres-connection.ts'

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')

async function loadMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR)
  return entries
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
}

const CONNECTION_STRING_PATTERN = /postgres(?:ql)?:\/\/[^\s'"]+/gi

/** Strips any `postgres://…`/`postgresql://…` substring (credentials included) out of a message
 * before it is ever logged — defense in depth on top of never logging the URL directly. */
export function redactConnectionStrings(text) {
  return text.replace(CONNECTION_STRING_PATTERN, 'postgres://[redacted]')
}

export async function runMigrations(input = {}) {
  const env = input.env ?? process.env
  const connectionString = resolvePostgresConnectionString(env)
  if (!connectionString) {
    throw Object.assign(new Error('DATABASE_URL_OR_POSTGRES_URL_REQUIRED'), { code: 'DATABASE_URL_OR_POSTGRES_URL_REQUIRED' })
  }

  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((row) => row.filename),
    )

    const files = await loadMigrationFiles()
    const appliedNow = []
    for (const filename of files) {
      if (applied.has(filename)) continue
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
      appliedNow.push(filename)
    }

    await client.query('COMMIT')
    return { appliedNow, total: files.length }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  const connectionString = resolvePostgresConnectionString(process.env)
  if (!connectionString) {
    console.error('db:migrate refused to run: set DATABASE_URL (or POSTGRES_URL) to a Postgres connection string first.')
    process.exitCode = 2
    return
  }

  try {
    const result = await runMigrations({ env: process.env })
    if (result.appliedNow.length === 0) {
      console.log(`db:migrate: nothing to do (${result.total} migration(s) already applied).`)
    } else {
      console.log(`db:migrate: applied ${result.appliedNow.length} migration(s): ${result.appliedNow.join(', ')}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(redactConnectionStrings(`db:migrate failed: ${message}`))
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  await main()
}
