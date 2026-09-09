# Unit 39 — Drive Outbox session (cursor ↔ run, one complete cycle)

## Status

v0. Server-side composition in `lib/server`. Ports are still injected; no Drive API
implementation, no OAuth, no scheduler.

## Why

Unit 37 runs but remembers nothing. Unit 38 remembers but never runs. Neither knows the other
exists. This unit is the cycle: **load the cursor → run → advance the cursor**.

## Contract

```ts
runDriveOutboxSession({ lane, store, ports, context, now, mimeTypes? })
  => Promise<DriveOutboxSessionResult>
```

```ts
interface DriveOutboxSessionResult extends DriveOutboxRunResult {
  lane: string
  cursorAdvanced: boolean
}
```

## Order, and what each failure does

1. `store.loadCursor(lane)` — a failure here rejects. Running with an unknown cursor would
   re-ingest the entire outbox, and `eventId` dedup would be the only thing between that and a
   duplicated household history. **Not knowing the cursor is not the same as an empty cursor.**
2. `runDriveOutboxIntake(...)` with the loaded sets — a listing failure propagates
   (`DRIVE_OUTBOX_LIST_FAILED`) and the cursor is **not** advanced. Per-file failures do not
   propagate; Unit 37 already classified them as `unreadable`.
3. `store.advanceCursor(...)` with the run's deltas — only when there is something to advance.

`cursorAdvanced` reports whether step 3 actually wrote, so a caller can tell "nothing to do" from
"work done and remembered".

## Why an advance failure is allowed to be loud

If step 3 throws, the session rejects — the work happened but is not remembered.

That is deliberately **not** swallowed. The failure mode it leaves behind is the safe one: the
next run re-reads those files and re-ingests those records, and Unit 34's `eventId` dedup turns
the repeats into `duplicate` rather than new history. Reporting success while the cursor silently
did not move would produce the opposite: a caller believing the work is durable when it is not.

## Empty runs write nothing

An outbox with nothing new produces no `advanceCursor` call at all (`cursorAdvanced: false`).
Unit 38 already refuses to write empty deltas; the session does not rely on that alone, because
depending on a downstream no-op to express intent hides the intent.

## Out of scope

The Drive API implementation of the ports, OAuth, a route or CLI trigger, scheduling, retry
policy, and any UI.
