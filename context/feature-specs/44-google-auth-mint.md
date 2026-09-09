# Unit 44 — Minting a Google read-only refresh token

## Status

v0. Recovers the one live asset from an abandoned branch, with the defect it carried fixed.

## Why this exists

The repository could **use** a Google refresh token in three places and **mint** one in none.
`google-calendar-web-transport.ts`, `google-household-preview-bootstrap.ts` and
`scripts/drive-outbox-run.mjs` are all consumers. Nothing produced the value they consume.

That is why the Drive lane — complete and green through Units 33–43 — had never run. The tracker
recorded the blocker as "a human with household credentials", but no such credentials could be
obtained with anything in this repository.

The tool to obtain them existed, on `feature/chad-family-os-core-v0.1` (PR #7): a local loopback
OAuth flow, `scripts/google-calendar-auth.mjs`. That branch is otherwise superseded — its 119
unique files are a v0-generated One-Box UI and a separate `context/feature-specs/01–23` lineage
that has nothing to do with main's own 01–43. This unit takes the part that is still alive.

## What changed in the port

### 1. The original had no `state` — loopback CSRF was open

The local callback server accepts **any** request to its port. With no `state` check, a page open
in the operator's browser could call
`http://localhost:<port>/oauth2callback?code=<attacker code>` and the tool would exchange it,
writing **the attacker's refresh token into the owner's file**. This is the known attack on
loopback OAuth, and `state` is the standard defence.

`lib/server/google-auth-callback.ts` is the pure decision — separated out because it is the only
security-bearing judgement in the tool, and buried inside a real OAuth round trip it could not be
tested at all. Order matters: **`state` is checked before the provider's `error`**, otherwise
someone who does not know the nonce could kill the owner's sign-in flow with a bare `?error=`.
A path that is not the callback is `ignore`, not a rejection — browsers request `favicon.ico`
on the same port, and counting that as a failure would let the operator's own browser kill the flow.

### 2. Client credentials come from env, not a file path

The original read a Google client-secret JSON from
`GOOGLE_CALENDAR_SOURCE_<KEY>_CLIENT_SECRET_PATH`. `main` uses env (`DRIVE_OUTBOX_CLIENT_ID` /
`DRIVE_OUTBOX_CLIENT_SECRET`) — the same mismatch already corrected once in Unit 41.

### 3. The output is a credential, so it is treated as one

- Written with mode `0600`, as `DRIVE_OUTBOX_REFRESH_TOKEN=…` so it can be pasted into `.env.local`.
- Default path `.env.drive-outbox` — a name `.gitignore` already covers, so the file cannot be
  committed by construction.
- `assertSecretOutPath` refuses any in-repo path that is not a top-level `.env*`. The entire output
  of this tool is a long-lived credential; a single `git add -A` would put it in a public
  repository. Paths outside the repository are the owner's choice and are not judged.
  The check does not rely on `.gitignore`'s `.env*` matching in subdirectories — allowing only what
  is certainly ignored is better than allowing what is probably ignored.
- **The token value is never printed.** Confirmation is a 12-hex `sha256` fingerprint. Terminal
  scrollback, CI logs and screenshots are not places anyone decided to keep a long-lived credential
  (same reasoning as Unit 41's counts-only output).

## Scope

Read-only scopes only, resolved through `resolveGoogleReadOnlyScopes` — the table Unit 36
extended with `drive.readonly`. This tool reads nothing from Google; it only obtains permission.
An unsupported service fails before the browser opens rather than after.

## Evidence

13 tests on the pure decisions. Four mutations confirmed the callback tests bite:

| Mutation | Failed |
|---|---|
| `state` checks removed entirely | 3 tests |
| `state` / provider-error order swapped | 1 test |
| empty `expectedState` allowed | 1 test |
| non-callback paths handled instead of ignored | 1 test |

Four fail-closed paths of the entry point were executed for real (no Google contact required):
missing client credentials, unsupported service, a committable out path, and a subdirectory
`.env`. Each refused with its named error.

630 + 13 = 643 tests, `hyodo:check` 5/5.

## Verification limit

The actual Google round trip is unverified. It requires a person with the household's Google
account in front of a browser — no build seat can do it. The judgement logic is tested; this
entry point is the untested seam between that logic and Google, and running it is how that changes.
