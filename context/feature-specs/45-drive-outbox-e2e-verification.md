# Unit 45 — Drive Outbox end-to-end, verified in production

## Status

Verification receipt, 2026-09-09. No new capability. This unit records the first time a real
handoff record travelled Drive → parse → intake → cursor, against the real Google API and the
production database.

Every prior unit in this lane (33, 34, 36–44) carried the same honest caveat: *shape-verified,
round-trip unverified*. No session in this repository had ever made a real `drive.files.list`
call. That caveat is now retired.

## What was actually run

| Step | Result |
|---|---|
| 1. Real OAuth round trip | `AUTH_OK`, refresh token minted |
| 2. Real `drive.files.list` | `files=2` — the smoke record and the template |
| 3. One-shot ingestion (test DB) | `accepted=1 skipped=1 cursorAdvanced=true` |
| 4. Repeated run (test DB) | 2nd and 3rd runs `accepted=0 skipped=2 cursorAdvanced=false`, cursor 2 → 2 → 2 rows |
| 5. Digest validation | `artifact.state=confirmed` with a genuine SHA-256 |
| 6. Production Neon promotion | 1st `accepted=1`, 2nd `accepted=0`, cursor stable at 2 rows |
| 7. Cron | **intentionally deferred** — see below |

## The account had to be verified, not assumed

`AUTH_OK` appeared without anyone in this session having clicked a consent screen: the `open`
call had launched the URL in a browser window outside the automated tab, and the flow completed
there. That leaves the single most important fact unknown — *whose* Drive the token can read.

A token for the wrong account does not fail loudly. It returns an empty folder, and an empty
folder is indistinguishable from a working lane with nothing in it. That is a success-shaped
failure, which is the exact class of defect this lane has spent ten units guarding against.

So the token was asked directly, read-only, before anything else ran:

```
drive.about.get(fields: user)  →  bigbananamusic@gmail.com
```

That is the account that owns the outbox folders. Only then did step 2 proceed.

## The test fixture is real, not invented

Two files were created in Drive for this verification:

- `SMOKE_ARTIFACT_2026-09-09.txt` (261 bytes) in the `10_JAY` lane root — the thing the record
  points at.
- `HANDOFF_RECORD_2026-09-09_outbox-smoke.txt` (623 bytes) in `10_JAY/04_DORANDORAN_OUTBOX` —
  the record itself.

The record's `digest` is the actual SHA-256 of the artifact's bytes, confirmed by matching the
local byte count against the size Drive reported (261 = 261). It is not a placeholder hash.

`driveFileId` points at the artifact, not at the record's own file. That distinction matters and
was checked against spec 31 before writing anything: *"Drive file bytes never enter this unit;
only `driveFileId` and `digest`."* A runner that injected the record's own file id would be
asserting that the record file **is** the artifact, which is false. Nothing injects it, and that
is correct.

## A stale cursor nearly misread step 3

An earlier dry run (real Postgres, injected Drive port) had written the same lane and the same
`eventId` into the test database. Left in place, step 3 would have reported `duplicate=1` instead
of `accepted=1` — a correct result from the code, read as a failure by a human. The test cursor
was truncated first, and the pre-existing rows were printed before deleting them so the deletion
was not silent.

## Why `duplicate=0` on the repeat run is the stronger result

The second run reports `skipped=2 (template_file, already_processed)` and **no** duplicates. The
file is filtered at plan stage, before it is read — the Drive API is not called for it at all.

`duplicate` (the `eventId` check) is the second line of defence, for when the cursor has been
lost. What this verification exercised is the first line holding. Both layers exist; only the
outer one was needed.

## Production migration state was not what the tracker implied

Production carried `0001_lifecycle.sql` only. `0002_drive_outbox_cursor.sql` had never been
applied, so `drive_outbox_cursor` did not exist there. Anyone running `outbox:run` against
production before today would have failed on a missing table.

Before applying it, the SQL was read rather than trusted: `CREATE TABLE IF NOT EXISTS` plus
`CREATE INDEX IF NOT EXISTS`, with no `DROP`, `TRUNCATE`, `DELETE` or destructive `ALTER`. Purely
additive, and safe on a database holding real household data.

## Production state after the run

```
drive_outbox_cursor
  10_JAY  event  outbox-smoke-2026-09-09-001
  10_JAY  file   1DUXlKea802AfgdhIQgQbxNaPjHjNjuZ2

duplicate rows        0
lifecycle_capture     0
lifecycle_candidate   0
lifecycle_task        0
```

`outbox:run` writes the cursor and nothing else — it does not persist captures, candidates or
tasks. The household's existing tables were unchanged by this verification, and the counts above
are the evidence rather than the claim.

## Step 7 — nightly reconcile, production-verified

`/api/cron/reconcile` is scheduled by `vercel.json` and protected by the production-only
`CRON_SECRET` Bearer authority. Each accepted Drive handoff is persisted as a scoped Capture and,
only when the handoff contains an explicit candidate proposal, as a Candidate. The ingest ledger
and lifecycle rows commit in one transaction; the Drive cursor advances only after the callback
completes. The route never decides or creates a Task.

Production evidence on 2026-09-10:

```text
unauthorized request       401 CRON_UNAUTHORIZED
authenticated request      200
00_DORANDORAN_FAMILY       connected, skipped=1
10_JAY                     connected, skipped=2
20_SHARED_PROJECTS         connected, skipped=1
```

The current empty workload is truthful: no new Capture/Candidate was invented and no cursor was
advanced. A future accepted handoff will exercise the same route and persist through the
idempotent ledger.

## What is deliberately not in this receipt

No client secret, no refresh token, no access token, no connection string. The tool prints a
12-hex SHA-256 fingerprint of the refresh token instead of the token, and this document records
outcomes, digests and cursor values only. `.env.local` holds the live credentials at mode `0600`
and is covered by `.gitignore`'s `.env*`; both were confirmed rather than assumed.

The two Drive smoke files are **kept**. They are harmless — every later run skips the record as
`already_processed` — and deleting them is a destructive action that nobody has asked for.
