# Unit 37 — Drive Outbox run (end-to-end orchestration with injected I/O)

## Status

v0. Deterministic given its injected ports; it performs no network call, no OAuth, and no
persistence of its own. Units 34 and 36 produced every piece of the Drive lane, but nothing
joined them into a single run. This unit is that join.

## Why

The lane's pieces exist and none of them touch each other:

| unit | has | missing |
|---|---|---|
| 34 | plan what to fetch, classify a batch | never reads a file |
| 36 | text → record, `drive.readonly` | never sees a file list |
| 31 | record → CaptureEvent | zero call sites until 34 |

Joining them needs I/O, and the real OAuth round trip cannot be verified from a build seat —
only from an authenticated session. So the join takes its I/O as **ports**: the orchestration is
tested here, and only the transport implementation is left for a session that can authenticate.

## Ports

```ts
interface DriveOutboxPorts {
  listFiles(): Promise<readonly unknown[]>                        // Drive v3 files.list payloads
  readFile(fileId: string): Promise<{ text: string; mimeType: string }>
}
```

Both are async and both may throw; a throwing port is a reported outcome, never a crash of the run.

## Run

```ts
runDriveOutboxIntake({ ports, processedFileIds, processedEventIds, context, mimeTypes? })
  => Promise<DriveOutboxRunResult>
```

Order:

1. `listFiles()` → normalize each payload through Unit 36's `normalizeDriveOutboxFile`.
   A payload that cannot be identified is recorded as `unreadable` and does not abort the listing.
2. Unit 34 `planDriveOutboxIntake` → the fetch list and the skip list.
3. For each planned file, `readFile()` → Unit 36 `parseOutboxRecordText` → an entry.
   A read failure or an unparsable body is recorded as `unreadable`; the run continues.
4. Unit 34 `ingestDriveOutboxBatch` on everything that produced a record.

Result:

```ts
{
  entries: OutboxEntryResult[]      // accepted | duplicate | rejected, from Unit 34
  skipped: OutboxSkip[]             // already_processed | unsupported_type, from Unit 34
  unreadable: { fileId: string; reason: 'list_payload' | 'read_failed' | 'parse_failed' }[]
  processedFileIds: string[]
  processedEventIds: string[]
}
```

## One file never stops the run

Every per-file failure is an entry in `unreadable`, not a thrown error. Three lanes write into
their own outboxes; a single unreadable file must not stall the household. This mirrors Unit 34's
batch rule rather than inventing a second policy.

`listFiles()` itself throwing is different: with no listing there is nothing to be partial about,
so the run rejects with `DRIVE_OUTBOX_LIST_FAILED`. A failure to observe is not an empty folder.

## Unreadable files are still processed

A file that could not be read or parsed is included in `processedFileIds`, exactly as Unit 34
treats a rejected record. Otherwise the next run re-reads the same broken file forever.

The cost of that choice is stated plainly: a file that failed for a transient reason will not be
retried. Retry belongs to whoever owns the cursor, and that owner does not exist yet — which is
why the deltas are returned rather than stored.

## Out of scope

The Drive API implementation of the ports, OAuth token exchange, persistence of the processed
sets, a route or scheduler, retry policy, and any UI.
