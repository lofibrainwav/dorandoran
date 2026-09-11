# ADR-001: Apple Shared Library metadata delta stream

**Status:** Proposed
**Date:** 2026-09-10
**Deciders:** Family OS owner

## Context

DoranDoran must observe the Apple Photos library shared with the family without
copying photographs, thumbnails, video, faces, or raw EXIF to the server. The
current production path reads one privacy-sanitized Drive snapshot and is
intentionally small, explicit, and fail-closed. It is not a live stream and
must not be widened into a multi-file scan.

Apple Photos access is device-bound. A server or Vercel deployment cannot
directly observe an iPhone Photos library. The source therefore needs a
device-side bridge that emits metadata changes, while DoranDoran stores only a
normalized metadata index.

## Decision

Build a read-only iPhone companion using PhotoKit. The companion will:

1. request the least privilege needed to read the user's approved Photos scope;
2. establish a baseline of metadata only;
3. retain and serialize a PhotoKit persistent change cursor locally;
4. emit idempotent `upsert` and `delete` metadata events after changes;
5. retry delivery over HTTPS with a bounded queue;
6. never request or transmit image/video bytes, thumbnails, faces, or raw EXIF.

DoranDoran will expose an authenticated metadata ingest endpoint and a
Postgres-backed cursor/index. The server will acknowledge an event batch only
after the metadata transaction and idempotency check succeed. The web UI will
render `LIVE`, `STALE`, or `OFFLINE` based on the last accepted event time; it
will not claim real-time freshness when the phone has not delivered a recent
heartbeat.

The existing Drive photo snapshot remains a bootstrap/manual fallback. It is
not expanded into a shard scanner and does not become the Apple Photos stream.
Drive continues to be the durable source for artifacts and handoffs.

## Proposed contract

### Event envelope

```json
{
  "protocolVersion": 1,
  "deviceId": "opaque-device-id",
  "libraryScope": "family-shared",
  "cursor": "opaque-photo-library-token",
  "sentAt": "2026-09-10T12:00:00.000Z",
  "events": [
    {
      "operation": "upsert",
      "photo": {
        "cloudId": "opaque-cloud-id",
        "capturedAt": "2026-09-10T12:00:00.000Z",
        "modifiedAt": "2026-09-10T12:01:00.000Z",
        "mediaType": "image",
        "latitude": 34.1,
        "longitude": -118.2
      }
    },
    {
      "operation": "delete",
      "cloudId": "opaque-cloud-id"
    }
  ]
}
```

The production contract must reject unknown fields that could carry raw
content. Coordinates and timestamps are validated before persistence.

### Server tables

- `apple_photo_metadata`: library scope, cloud id, captured/modified time,
  optional coordinates, media type, last seen, deleted-at, source device.
- `apple_photo_cursor`: library and device scope, last accepted cursor and
  event time.
- `apple_photo_event_receipt`: library/device/batch digest idempotency key and
  accepted cursor for safe retries. Household authorization remains at the
  authenticated route boundary.

The server stores no local device identifier that is sufficient to retrieve a
photo outside the authorized companion. Cloud IDs are treated as opaque
references, not public URLs.

## Options considered

### A. iPhone Shortcuts only

Useful for bootstrap and manual recovery, but not a reliable continuous
change stream. It has no durable PhotoKit change cursor under the app's
control and depends on user-triggered execution.

### B. Mac `osxphotos` agent

Useful for a local diagnostic fallback. It does not establish the requested
iPhone Shared Library boundary and should not become the production source.

### C. Native iPhone PhotoKit companion — selected

PhotoKit supplies metadata access, change observation, persistent change
tokens, and explicit authorization. It keeps the privacy boundary at the
device and supports resumable delta delivery.

## Failure and privacy rules

- No Photos permission: source is `disabled`, not empty.
- Limited permission: display the granted scope; do not infer full-library
  coverage.
- Cursor invalid or history unavailable: request a bounded rebaseline and mark
  the source `resync_required` until it is accepted.
- Network failure: queue metadata events locally and show `STALE` after the
  freshness window.
- Duplicate batch: acknowledge without duplicate rows.
- Delete event: tombstone metadata; do not delete a DoranDoran memory
  automatically.
- No coordinates: retain the memory with an unlocated count.
- Any raw content field: reject the batch and record a redacted reason.

## Ordered delivery plan

1. Confirm on a real iPhone that the authorized Photos scope includes the
   intended family-shared library and can expose the required metadata.
2. Freeze the TypeScript ingest schema and negative tests.
3. Add Postgres migration and idempotent store.
4. Add authenticated ingest route and read-only status route.
5. Build the minimal iOS companion baseline and persistent cursor lane.
6. Add retry queue and background refresh; do not promise continuous execution.
7. Connect the existing map/journey projection to the metadata index.
8. Run device, privacy, stale/offline, duplicate, delete, and production
   browser verification.

## Non-goals

- Copying or proxying photos through Drive or Vercel.
- Server-side Photos/iCloud credentials.
- Automatic publishing or task creation from a photo event.
- Treating a stale local snapshot as live data.
- Replacing Google Drive's Artifact/Outbox authority.
