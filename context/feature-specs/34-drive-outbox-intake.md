# Unit 34 — Drive Outbox intake (batch planning + dedup)

## Status

v0 pure, deterministic. No network call, no OAuth, no persistence, no scheduler.
A caller supplies the `04_DORANDORAN_OUTBOX` listing and the set of already-processed
identifiers; this unit decides what to read, parses the batch through Unit 31, and
classifies every outcome. Nothing here creates a Candidate decision or a Task.

## Why

Unit 31 turns one handoff record into a `CaptureEvent`/artifact observation, but nothing
calls it — `parseDorandoranHandoff` had **zero call sites** in the repository. The Drive
contract puts records in each lane's `04_DORANDORAN_OUTBOX`; something must walk that
folder, skip what it already ingested, and hand the rest to Unit 31 without inventing state.

This unit is that decision layer. It is deliberately I/O-free so the "what should happen"
question stays testable, exactly as Unit 30/31 are.

## Input contract

```ts
interface OutboxFile {
  fileId: string        // stable Drive file id
  name: string          // file title
  modifiedTime: string  // ISO-8601
  mimeType: string
}
```

Provider payloads are normalized into `OutboxFile` by `normalizeDriveOutboxFile` before they
reach the planner, mirroring how `google-calendar-rest-adapter` normalizes calendar payloads.
The Drive README's provider-neutral rule means the core must not encode one vendor's field
names.

## Two-stage contract

Reading a file costs a round trip, and the record id only appears *inside* the file. So the
unit dedups twice, at different costs:

### Stage 1 — `planDriveOutboxIntake({ files, processedFileIds, mimeTypes? })`

Decides what to fetch, before paying for any read.

- A file whose `fileId` is in `processedFileIds` is skipped (`already_processed`).
- A file whose `mimeType` is outside the accepted set is skipped (`unsupported_type`).
  Default accepted: `application/vnd.google-apps.document`, `text/plain`,
  `text/markdown`, `application/json`.
- Remaining files are returned as `fetch`, sorted by `modifiedTime` then `fileId`, so a
  batch is deterministic and the oldest handoff lands first.

### Stage 2 — `ingestDriveOutboxBatch({ entries, processedEventIds, context })`

Consumes what was actually read and classifies every entry. One malformed record never
aborts the batch — the Drive contract's other lanes must keep flowing.

| outcome | when |
|---|---|
| `accepted` | Unit 31 returned `ok`, and the record's `eventId` is new |
| `duplicate` | Unit 31 returned `ok`, but `eventId` was already processed |
| `rejected` | Unit 31 returned `ok: false` — carries its `code` and `field` verbatim |

The result also carries `processedFileIds`/`processedEventIds` *deltas* so the caller can
persist them; this unit holds no state between calls.

### Duplicate within one batch

Two entries carrying the same `eventId` in a single batch: the first is `accepted`, the rest
`duplicate`. Order is the caller-supplied entry order, which Stage 1 already made deterministic.

## Fail-closed rules

- An entry whose `record` is not an object fails as `rejected` with Unit 31's own
  `FIELD_MISSING` — this unit adds no new reject vocabulary.
- A blank/whitespace `fileId` or a non-ISO `modifiedTime` in `normalizeDriveOutboxFile`
  throws `INVALID_DRIVE_OUTBOX_FILE`. Unobservable input is not silently dropped.
- `processedFileIds`/`processedEventIds` absent is treated as empty, never as "everything
  processed" — a lost cursor must re-ingest, not skip.

## Out of scope

The Drive API call itself, OAuth scope wiring (`drive.readonly` is not yet in
`google-source-scopes`), persistence of the processed sets, a polling scheduler, an
`/api/lifecycle/drive-outbox` route, Candidate/Task creation, and any UI.
