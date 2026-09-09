# Unit 41 — Drive Outbox local trigger

## Status

v0. Splits the way `google-calendar-*` already does: the environment resolution is pure and
tested here, the executable entry point is not. Explicit local trigger only — no scheduler, no
route, no Drive write.

## Why

Units 33–40 are complete and nothing can run them. The lane needs one command a human can type
to find out whether the real round trip works, because that is the one thing no build seat can
answer.

## Two pieces, deliberately

| piece | verified |
|---|---|
| `lib/server/drive-outbox-runtime.ts` — env → config | yes, here |
| `scripts/drive-outbox-run.mjs` — entry point | no, needs real credentials |

Mirrors `resolveGoogleCalendarWebRuntimeConfig` / `google-calendar-smoke.mjs`. Keeping the
resolution pure means a misconfiguration is caught by a test rather than by a failed round trip
against someone's real Drive.

## Configuration

Per lane, because the three outboxes have separate folder ids and separate dedup sets:

```
DRIVE_OUTBOX_CLIENT_ID
DRIVE_OUTBOX_CLIENT_SECRET
DRIVE_OUTBOX_REFRESH_TOKEN
DRIVE_OUTBOX_FOLDER_<LANE>        # e.g. DRIVE_OUTBOX_FOLDER_10_JAY
```

A refresh token in the environment, not a credential file path: that is how `main` already reaches
Google (`google-calendar-web-transport`), and a Vercel surface has no file to read. The file-path
form belongs to the local-only WIP branch, not here.

`<LANE>` is the lane name uppercased with every non `[A-Z0-9_]` character replaced by `_`, the
same normalization `google-calendar-smoke.mjs` uses for its source keys.

### Health, not booleans

`driveOutboxRuntimeHealth(env, lane)` returns:

- `off` — no Drive variable set at all. The lane is simply not configured; that is not an error.
- `incomplete` — some set, some missing. This **is** an error, and resolving throws
  `INCOMPLETE_DRIVE_OUTBOX_CONFIG`. Half a configuration is the state that produces a confusing
  failure deep inside a transport call.
- `ready` — all three present.

The distinction is taken from `calendarWebRuntimeHealth`; a plain "is it configured" boolean
cannot tell "not set up" from "set up wrong".

## What the trigger does

1. Resolve config for the requested lane; `off` exits cleanly saying so.
2. Build a Drive client from the refresh token (no interactive flow — a run command that can pop
   a browser is not a run command).
3. Decode the response body: a `string` passes through, a `Buffer`/`ArrayBuffer` is decoded as
   UTF-8 **in the adapter**, and anything else is left for the port to refuse. Explicitly decoding a
   known binary representation is not the same as `String(buffer)` — the port stays strict, and the
   adapter converts only what it actually recognizes.
4. `createDriveOutboxPorts` + the Postgres cursor store + `runDriveOutboxSession`.
   No `DATABASE_URL` is a refusal, not a fallback to memory: a run with a volatile cursor re-ingests
   the whole outbox next time, which is exactly what Unit 39 exists to prevent.
5. Print counts only: accepted / duplicate / rejected / skipped / unreadable, and whether the
   cursor advanced.

### Printing counts only is a privacy decision

The records carry `statedText` — what a family member actually said. A trigger that echoes them
into a terminal, a CI log, or a screenshot has moved private household content somewhere nobody
decided to put it. Counts answer "did it work"; the content stays in Drive and DoranDoran.

## Out of scope

Interactive OAuth (owned by `google-calendar-auth`), scheduling, retry, writing to Drive,
promoting records into Candidates or Tasks, and any UI.
