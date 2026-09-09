# Unit 38 — Drive Outbox cursor store (the owner Unit 37 said did not exist)

## Status

v0 persistence. Two implementations behind one interface (memory, Postgres), following
`lifecycle-store`. This is server-side by nature and lives in `lib/server`.

## Why

Unit 37 returns `processedFileIds`/`processedEventIds` as **deltas** and stores nothing, with the
cost stated in its spec: "retry belongs to whoever owns the cursor, and that owner does not exist
yet." This unit is that owner.

Without it every run re-reads the whole outbox and re-ingests every record, so `eventId` dedup
would be the only thing standing between a repeated run and a duplicated household history.

## Model

One table, two kinds of marker:

```sql
drive_outbox_cursor(lane, kind, value, processed_at)  -- PK (lane, kind, value)
kind IN ('file', 'event')
```

One table rather than two so a single multi-row `INSERT` advances files and events **together**.
Two tables would need a transaction to avoid a half-advanced cursor, and a half-advanced cursor is
the one state that silently loses records.

`lane` separates the three outboxes (`00_DORANDORAN_FAMILY`, `10_JAY`, `20_SHARED_PROJECTS`).
A blank lane throws `DRIVE_OUTBOX_LANE_REQUIRED`; a cursor with no lane would merge three
households' dedup sets into one.

## Interface

```ts
interface DriveOutboxCursorStore {
  loadCursor(lane: string): Promise<{ fileIds: string[]; eventIds: string[] }>
  advanceCursor(input: {
    lane: string
    fileIds: readonly string[]
    eventIds: readonly string[]
    now: string
  }): Promise<void>
}
```

`loadCursor` returns sorted arrays, so a run's plan is reproducible regardless of storage order.

## Idempotent by construction

`advanceCursor` re-applying the same values must be a no-op, not an error: a run that succeeds and
then fails while reporting will be retried with the same deltas. Postgres uses
`ON CONFLICT DO NOTHING`; memory uses a set.

Advancing nothing (`fileIds: []`, `eventIds: []`) issues no write at all. An empty run must not
touch the table.

## What this unit does not decide

It does not decide **whether** something was processed — Unit 34/37 already did. It only
remembers. No validation of id shapes, no expiry, no retry policy.

## Known cost, stated rather than hidden

The cursor grows without bound: one row per file ever seen and one per record ever accepted.
Nothing prunes it. That is acceptable at household scale (hundreds of rows per year) and would
not be at another scale. Pruning needs a rule about how long a `fileId` must be remembered before
re-reading it is safe, and that rule does not exist yet — inventing one here would be guessing.

## Out of scope

Wiring the store into a run, the Drive API ports, a route or scheduler, pruning, and any UI.
