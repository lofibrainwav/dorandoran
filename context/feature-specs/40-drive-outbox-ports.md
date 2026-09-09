# Unit 40 — Drive API ports (`listFiles` / `readFile`)

## Status

v0 transport. **The real Google round trip is unverified from a build seat** — no session here can
complete an OAuth exchange against the household's Drive. What *is* verified: the request shape,
pagination handling, the Docs-vs-binary branch, and every failure path, all against an injected
client. Commander approved landing it on that basis (2026-09-09).

## Why

Units 33–39 are done and none of them touch Drive. Unit 37 takes its I/O as ports precisely so
this piece could be written and judged separately. This is that piece.

## Injected client, not a global

```ts
interface DriveFilesClient {
  list(params: { q: string; fields: string; pageSize: number; pageToken?: string }):
    Promise<{ data: { files?: unknown[]; nextPageToken?: string } }>
  get(params: { fileId: string; alt: 'media' }): Promise<{ data: unknown }>
  export(params: { fileId: string; mimeType: string }): Promise<{ data: unknown }>
}
```

Shaped after `googleapis`' `drive.files` so the real client drops in, but injected so the
orchestration above it stays testable. `createDriveOutboxPorts({ client, folderId })` returns the
`DriveOutboxPorts` Unit 37 expects.

## Listing: complete or loud

`assertGoogleCalendarPageComplete` throws when a `nextPageToken` appears, because a truncated
page is not a smaller folder. The same principle applies here, but an outbox can legitimately hold
more than one page on a first run, so this port **follows** the pages instead of refusing them —
and stops loudly rather than silently:

- pages are followed while a `nextPageToken` is returned;
- after `DRIVE_OUTBOX_MAX_PAGES` (10) it throws `DRIVE_OUTBOX_LISTING_TRUNCATED`.

Ten pages at `pageSize: 100` is a thousand files — far past anything a household outbox should
hold, so reaching it means something is wrong, not that the folder is busy. A repeated page token
also throws: a server that keeps handing back the same cursor would otherwise loop forever.

The query is `'<folderId>' in parents and trashed = false`. Trashed files are not deleted files —
reading one would ingest a record its owner already withdrew.

## Reading: two shapes, one contract

- `application/vnd.google-apps.document` → `files.export({ mimeType: 'text/plain' })`. A Google Doc
  has no bytes to download; `alt: 'media'` on one fails.
- everything else → `files.get({ alt: 'media' })`.

Both return `{ text, mimeType }`. A non-string body throws `DRIVE_OUTBOX_UNREADABLE_BODY` rather
than being coerced — `String(buffer)` would hand Unit 36 a plausible-looking `[object Object]`.

The returned `mimeType` is the **file's** type, not the export type, so Unit 36 routes on what the
file actually is.

## What this unit does not do

No OAuth, no token refresh, no credential reading, no write of any kind. `drive.readonly`
(Unit 36) is the entire grant this lane needs.

## Verification limit — stated plainly

Every test here uses an injected fake. Nothing in this repository has yet made a real
`drive.files.list` call. Until a session with working household credentials runs one, the correct
description of this unit is **"shape-verified, round-trip unverified"**, and the tracker says so.

## Out of scope

OAuth token exchange, credential storage, a CLI or route trigger, scheduling, retry, and any UI.
