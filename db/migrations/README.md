# db/migrations

- Order: files apply in filename order (`0001_...`, `0002_...`, ...) — the numeric prefix is the sequence, never reorder or renumber an already-applied file.
- Idempotency: every statement uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, and each filename is recorded once it succeeds, so re-running the full set is always a no-op.
- Run: `pnpm db:migrate` (reads `DATABASE_URL`, falling back to `POSTGRES_URL`; refuses to run with neither set).
