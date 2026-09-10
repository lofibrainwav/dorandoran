# Progress Tracker

## Active handoff — 2026-09-09

Units 29–32 landed on `main` today, all through PR + Greenfield Quality + HyoDo shadow; `main` push now also triggers CI (`26fbe0d`).

- Unit 29 ([planner recommendations](feature-specs/29-planner-recommendations.md)) `9b86703` — gap-fitting wish recommendations, lazy-loaded in `/family` with fallback to auto-placement.
- Unit 30 ([artifact registry / night reconcile / daily capsule](feature-specs/30-artifact-registry-night-reconcile-daily-capsule.md)) `93da1d0` — artifact registry remains a pure read model; Daily Capsule v1 is now a durable household-local projection.
- Unit 32 ([family coordination anchor](feature-specs/32-family-coordination-anchor.md)) PR #28 merge `97490bb` — ported from the 2026-09-07 WIP branch `feature/chad-family-os-core-v0.1` (122 behind main, unmergeable); only the pure module moved.
- Unit 31 ([Drive handoff intake](feature-specs/31-drive-handoff-intake.md)) PR #29 merge `fbf3ffd` — the code-side receiver for the provider-neutral Google Drive AI contract (`00_START_HERE_DORANDORAN_AI_README`, MOC 00/10/20, `DORANDORAN_HANDOFF_TEMPLATE` v1, 2026-09-09). Independent adversarial review (FAIL 3 / WARN 2) was repaired before merge. Drive-side reconciliation findings (field-name drift, `child-controlled`, missing `digest`) are recorded in bb `02-Projects/kingdom-os/dorandoran/2026-09-09-drive-contract-reconciliation.md` and await the Drive contract owner.

Regression count is 522 tests. Unauthenticated `/` and `/family` still 307 → `/signin`; authenticated UI was not re-observed today. The historical notes below do not supersede this handoff.

## UI reality — 2026-09-10

- Family planner first-pass responsive repair is applied in `app/planner.css`: the family-role legend wraps instead of clipping on narrow screens, and the Sunday-first time grid keeps an explicit horizontal navigation surface with snap behavior and a sticky time axis on mobile.
- Validation after the UI-only change: lint, typecheck, 652 family/core tests, and production build all pass. No API, auth, or data contract changes.
- UI progressive disclosure is now wired in `components/family-planner.tsx` and `app/planner.css`: event preparation, connection status, and advanced context open in accessible desktop modals or mobile bottom sheets; the long inline preparation section is reduced to a compact launcher.

## Current state
- Greenfield worktree created from `main`.
- Legacy UI shell removed.
- Verified `lib/family-os` and 98 regression tests imported from remote GREEN head.
- Node 24.20.0 installed keg-only for this worktree.
- HyoDo v4.14.0 pinned through `uvx` locally.
- HyoDo audience profile: `vibe`.
- HyoDo gates: typecheck, build, tests, prod audit, lint.
- HyoDo safe strict: GREEN.
- HyoDo check strict-tests: GREEN, 5/5 observed.
- Family OS regression: 184/184 PASS.
- Next production build: PASS.
- Production audit: 0 known vulnerabilities.

## Compatibility decision
- TypeScript 7 / ESLint 10 were rejected as an unverified peer combination.
- Baseline uses TypeScript 6.0.3 and ESLint 9.39.5 until the Next lint stack supports newer peers.

## Completed design/core unit
- Static Family Gravity Grid baseline landed.
- Universal Context Adapter + Connection/Capability registries landed.
- Provider-neutral 6W1H observation grammar landed.
- Family evidence lenses 眞/善/美/仁/孝 remain separate; no composite family score.
- 永 time axis is fixed Past → Year → Month → Week → Today → Now.
- MapLibre 6.7.0 globe presentation prototype landed with public-safe LA demo data.
- Product time labels are Past Journey → Year → Month → This Week → Today → Now.
- Person focus uses ids and declared specialist modules; core contains no Jayden/Julie/Apple/Google hardcoding.
- Calendar place remains Scheduled unless explicit live-presence evidence exists.
- Family Operating Read Model now derives privacy-safe NOW/NEXT and Scheduled/Unknown place from canonical observations.
- The hero public demo now flows Adapter → ContextObservation → Family Operating Read Model → UI.
- Today/Now keeps WHAT separate from structured WHEN; the hero renders the next local clock time only from an explicit source time zone.
- WATCH now comes only from a structured WeekEventInsight projection; confirmed stays quiet and arbitrary free-text WATCH was removed from the operating person model.
- HANDOFF now projects only id/state/work modes/evidence refs; raw descriptions do not enter the client projection.
- Private Calendar Operating Source now maps source keys to explicit person ids and projects authorized timed events through the same ContextObservation → Family Operating Read Model boundary.
- Local Google Calendar transport is server-only and uses pinned `googleapis@178.0.0`; OAuth/token contents never enter projection results.
- `/family` now has an explicit local-only private surface gate; Vercel/public runtime blocks that private path by construction.
- Private local readback is GREEN and the public production simulation renders Family Week with no private source badge or secret-bearing fields.
- Jayden Learning is now a specialist module projection, not duplicated Family OS logic.
- Current verified JDK release transport is parent-session/capsule/same-origin bound with no delegated bridge, so the Learning module truthfully renders `Bridge pending` instead of pretending it is connected. Since 2026-09-08 that state is derived from `DORANDORAN_JDK_BRIDGE_URL` + a live `/status` probe (20 s in-process cache, run in parallel with the calendar loaders) (see spec 09 contract), not from constants; the JDK-side status endpoint is still to be built.
- Local private readback contains the Learning bridge status; public/Vercel simulation contains no private module projection.
- Route and Presence now project as separate physical-world evidence channels; Calendar `Scheduled` never becomes `Live` by implication.
- Presence requires explicit timestamped evidence for `Live`; last-known and missing evidence fail closed without promotion.
- Route keeps proven tight fits clear, watch distinct, and real friction explicit.
- Month projection is a fixed 42-cell Sunday-first grid; Year projection is 12 months from the same canonical observation stream.
- Temporal display projections strip evidence refs before client rendering, so aggregation can drive the UI without leaking private evidence ids.
- Month/Year now overlay the same operating stage instead of becoming separate apps, preserving the zoom grammar.
- Past Journey now projects confirmed canonical memory observations into privacy-safe place clusters for the world globe.
- Unlocated memories remain countable but never become invented map points; schedule/future planning does not become past memory.
- Public demo markers are explicitly labeled as demo memories; private photo/file evidence refs are stripped from the client display projection.
- Private Month/Year now reads one exact LA-local calendar year and projects both grids from the same server-only observation set.
- Real private readback is GREEN: 46 timed events across 9 active months, with 4 active cells in the current month; no titles/locations/ids were printed.
- Photo Metadata Adapter now converts metadata-only photo evidence into canonical `memory` observations; raw pixels, file paths, thumbnails, and raw EXIF cannot enter the observation.
- Missing/invalid capture or place metadata remains unknown; photo metadata never emits live-presence semantics.
- Photo metadata composes directly with Past Journey clustering; Family OS regression is now 150/150 GREEN.
- Trip Grouping now partitions confirmed timed memory observations only by an explicit caller-supplied gap policy; no semantic trip or place name is invented.
- Untimed confirmed memories remain counted as ungrouped; schedules, stale evidence, and unrelated subjects are excluded.
- Family OS regression is now 154/154 GREEN.
- Past Journey Story Projection now converts structural trip groups into privacy-safe story cards using only confirmed count/time and explicit place labels.
- Story output contains no evidence refs, source refs, or place refs; no trip purpose, route, emotion, or destination is invented.
- Family OS regression is now 158/158 GREEN.
- Past Journey Experience now composes time-gap story cards with place-based globe clusters through one privacy-safe display contract.
- Coordinate-only memories can become exact-coordinate globe clusters labeled `Location recorded`; no place name is reverse-geocoded or inferred.
- Private Apple Photos selection source is implemented behind local-only + explicit opt-in gates; it requests only id/date/location and is capped at 100 selected items.
- Apple Photos `selection` canary remains flaky with AppleEvent timeout, while Photos app automation itself responds normally to lightweight commands.
- Designated-album fallback using pinned `osxphotos==0.76.1` is implemented; real designated-album transport canary is GREEN; the `DoranDoran` album is currently absent, so zero photo metadata was read or printed.
- Canonical public website metadata is `https://dorandoran.link`; the domain is now attached to Vercel project `dorandoran` (renamed from `v0-one-box` on 2026-09-08; GitHub repo renamed `one-box-mk` → `dorandoran` the same day).
- `dorandoran.link` DNS is verified and configured correctly on Vercel; the apex now resolves to the approved Vercel A record and HTTPS is live.
- Calendar range transport now fails closed when a next-page token indicates truncation.
- Private `/family` runs week and year reads in parallel, while public/Vercel still cannot enable the private surface.
- Regression count is 188 tests.
- GREEN Preview for HEAD `42078ba` was promoted to Production after explicit user approval.
- Live readback is GREEN: `https://dorandoran.link/` and `/family` both return HTTP 200.
- Public `/family` exposes no private local-source badge, Photos setup state, credential path, Apple evidence ref, or private snapshot path.
- (Historical) DoranDoran Site Password Gate was live in Production until 2026-09-08. It is retired under spec 25H: unauthenticated `/` and `/family` now redirect to `/signin`; `/unlock`, `/api/site-unlock`, `site-password-gate.ts` and the `DORANDORAN_ACCESS_CODE` / `DORANDORAN_GATE_KEY` Production keys are gone.
- Private Photo Setup Guidance now distinguishes ready, action-required album setup, and source failure without exposing private refs.
- Local production smoke exposed a performance blocker: live `osxphotos` album reads take about 17.2s cold (about 9.9s with `_skip_searchinfo`), so Photos DB work must leave the HTTP render path.
- Private Photo Snapshot now moves heavy Photos DB reads to explicit local refresh; `/family` reads only a versioned privacy-safe snapshot.
- Real refresh produced a 261-byte mode-0600 snapshot in about 20.5s with `partial/album-missing`; no asset/evidence/source refs or credential paths were persisted.
- Clean production `/family` smoke is HTTP 200 in 0.744s with snapshot truth visible and no private path/ref leakage.

- Drive migration is SEALED (2026-09-09): 222 moved, 0 deleted, 0 content-modified, 0 permission-changed, 5 canonical root entries. The Drive contract now names `person, kind, statedText, sourceRefs, evidenceRefs, unknowns` as canonical handoff core fields, limits `privacyScope` to `personal | family | professional`, states child control as a parent-controlled child-lane authority policy rather than a scope value, and requires `digest: sha256:<hex>` for `kind=final_artifact`.
- Artifact digest validation (Unit 33) implements the contract word that was missing — `valid`. Before it, only digest *presence* was checked, so `digest: "not-a-hash"` could reach the registry and be promoted to `confirmed`. Intake now rejects a malformed digest as `FIELD_INVALID`; the registry raises `ARTIFACT_DIGEST_INVALID`. An absent digest is still not a rejection: a `final_artifact` without one stays `ok` with `artifact: null`, because the contract prohibits the registry entry, not the capture.
- Drive Outbox intake (Unit 34) is the first thing that calls Unit 31, which previously had zero call sites. Stage 1 filters by `fileId`/`mimeType` before any read is paid for and orders the batch by `modifiedTime` then `fileId`; stage 2 classifies every entry as `accepted`, `duplicate`, or `rejected`, reusing Unit 31's reject vocabulary. One malformed record never aborts the batch. Rejected entries still mark their file processed. A missing processed set means re-ingest, never skip-everything.
- Authority propagation (Unit 35) fills `FamilyBlock.authorityRef`, which existed as an unvalidated bare string. A grant copies the human decision from Unit 28 (`by !== 'chad'`, `evidenceRef` required) and pins an `action` plus sorted, deduped `resources` under a digest computed the same way as KINGDOM's `scopeHash`, so a grant minted here stays verifiable downstream. All seven deny reasons fail closed, and the digest is verified before the scope is read. The hash function is injected: `lib/family-os` imports no `node:` module.
- `authority.ts` and `authority-propagation.ts` are different layers, not duplicates: the first decides whether an action needs a human gate at all, the second whether an approval already given covers this request.
- Family OS regression is now 553/553 GREEN with `hyodo:check` 5/5 (typecheck, build, tests, audit, lint).

- Outbox record parsing (Unit 36) fills the gap between a file's *text* and Unit 31's record object. It reads both the README's JSON block and the filled `DORANDORAN_HANDOFF_TEMPLATE`, and the template parser extracts only the field names Unit 31 knows — the file also carries prose, section headers, and lines like `LAST UPDATED: 2026-09-09` that a naive `key: value` scan would lift into fields. Untouched `<placeholder>` slots are dropped; only `candidateSuggested` is type-coerced, and a non-boolean value is passed through unchanged so Unit 31 rejects it rather than this layer guessing. `drive.readonly` is now a resolvable scope, and service support is a lookup against the scope table instead of a hardcoded condition.
- Drive Outbox run (Unit 37) joins Units 34/36/31 into one pass with injected I/O ports, because the real OAuth round trip cannot be verified from a build seat. A per-file failure is an `unreadable` entry, never a thrown error; a listing failure rejects with `DRIVE_OUTBOX_LIST_FAILED`, since a failure to observe is not an empty folder. Unreadable files are still marked processed, and the cost — a transient failure is not retried — is stated rather than hidden.
- Drive Outbox cursor (Unit 38) is the owner Unit 37 said did not exist. One table advances files and events together, because a half-advanced cursor is the one state that silently loses records. Advancing is idempotent by construction, an empty delta writes nothing, and a blank lane fails closed rather than merging three households' dedup sets. The cursor grows without bound and nothing prunes it: pruning needs a rule about how long a `fileId` must be remembered, and that rule does not exist yet.
- Drive Outbox session (Unit 39) closes the cycle: load cursor → run → advance cursor. A cursor load failure rejects before any file is read, because not knowing the cursor is not the same as an empty cursor. An advance failure is deliberately loud — the failure it leaves behind is re-ingest, which `eventId` dedup turns into duplicates, whereas swallowing it would report durability that does not exist.
- Family OS regression is now 593/593 GREEN with `hyodo:check` 5/5.

- Drive API ports (Unit 40) implement `listFiles`/`readFile` against an injected `googleapis`-shaped client. Listing follows pages but stops loudly: `DRIVE_OUTBOX_LISTING_TRUNCATED` past 10 pages (1,000 files, far beyond a household outbox) or on a repeated page token. The query excludes trashed files, because a trashed file is not a deleted one and reading it would re-ingest a record its owner already withdrew. Google Docs are exported as text; everything else is downloaded; a non-string body is refused rather than coerced. **Round trip unverified** — every test uses an injected fake.
- Drive Outbox trigger (Unit 41) is `npm run outbox:run -- --lane=<lane>`. Env resolution is pure and tested (`off | incomplete | ready`, because one boolean cannot distinguish "not set up" from "set up wrong"); the entry point is not tested because it needs real credentials. Auth is a refresh token in the environment, matching how `main` already reaches Google. A missing `DATABASE_URL` is a refusal rather than a fall back to a volatile cursor — that fallback would re-ingest the whole outbox next run, which is what Unit 39 exists to prevent. Output is counts only: records carry `statedText`, and a terminal or CI log is not a place anyone decided to put private household speech.
- Family OS regression is now 610/610 GREEN with `hyodo:check` 5/5.

- The first real read of the Drive outboxes (2026-09-09) corrected four defects no test had assumed (Unit 42). All three `04_DORANDORAN_OUTBOX` folders hold exactly one file — the `DORANDORAN_HANDOFF_TEMPLATE` itself — and no handoff records yet. Running the template's real text through the pipeline, it was rejected only because `eventId` was missing: `statedText: "\<final artifact statement\>"`, `digest: "sha256:<hex>"`, and `unknowns: ["[]"]` had all survived parsing, and the template's EXAMPLE section was overwriting the placeholder section above it. Fixes: the template file is skipped by name before it is read (`template_file`), placeholders are recognized after unescaping and when merely contained in a value, `[]` is an empty list rather than an item, and first-write-wins keeps what a sender filled in over the specimen below it. Escaping is a transport artifact, not content, so the unescaped value is what gets stored — leaving it escaped made Unit 31 reject on an enum mismatch, which is an accidental defense rather than an honest verdict.
- Plan-stage verification against the real file metadata: all three lanes return `fetch=0, skipped=[template_file]`. The parser now yields the same result whether Drive returns the text escaped or plain.
- Family OS regression is now 618/618 GREEN with `hyodo:check` 5/5.

- First real measurement of the live site (dorandoran.link, 2026-09-09). Production serves commit `e47e029` — the same commit as local `main`. TLS is a Let's Encrypt wildcard valid to 2026-12-07; Next 16.3.4 on Node 24.x. `proxy.ts` (Next 16's name for middleware) redirects every path to `/signin` with 307, including paths that do not exist, so the gate answers before routing and does not reveal which routes are real. Only `/signin` and `/api/auth/google` are public. The 307 — rather than the fail-closed 503 — is itself the evidence that `GOOGLE_WEB_CLIENT_ID`, `DORANDORAN_AUTH_SECRET` and `DORANDORAN_HOUSEHOLD_MEMBERS_JSON` are all set in production and that membership parses non-empty. Preview domains are separately covered by Vercel SSO. Security headers (HSTS, XFO DENY, frame-ancestors none, nosniff, noindex, no-store) are all present.
- Postgres `sslmode` pinning (Unit 43) came from that measurement, not from a test. Production runtime logs carry a pg warning that `prefer`/`require`/`verify-ca` are *currently* aliases for `verify-full` and will adopt weaker libpq semantics in pg 9 — on `/api/lifecycle/tasks` and `/api/lifecycle/candidates`, `users=2`, so the household is really using the product. The comment in `lifecycle-store.ts` had recorded the aliasing accurately; the word carrying the risk was "currently", because `verify-full` was a property of the installed library version rather than of the connection string. A dependency bump would therefore have removed certificate verification for the family database with no code change, no error, and every gate green. `pinPostgresSslMode` writes today's meaning into the string; `resolvePostgresConnectionString` consolidates the `DATABASE_URL || POSTGRES_URL` resolution that had been written three times and attaches the pinning so a call site cannot forget it. It refuses to inject TLS where no `sslmode` was given, leaves `disable`/`verify-full` and any `uselibpqcompat` opt-in alone, and replaces only the `sslmode` value rather than re-serializing a URL that carries credentials. Because the regression it prevents cannot happen yet, three mutations of the implementation were run to confirm the tests actually fail when the behaviour is removed. Fixing this also surfaced a latent typing bug: narrowing of the connection string was already being lost inside the hoisted `ensurePool` declaration, and had only typechecked because `undefined` happened to be assignable to pg's `connectionString?: string`.
- Family OS regression is now 630/630 GREEN with `hyodo:check` 5/5.

- The home page is not public, by decision (Commander, 2026-09-09). `app/page.tsx` called itself a "Public demo" while production `/` returned 307 to `/signin`, and nothing recorded a choice: `/` was absent from `PUBLIC_ACCESS_PATHS` as a consequence of 25H's "everything else redirects", and `decideHouseholdAccess`'s tests asserted `/family`, `/signin` and `/unlock` but never `/`. Anyone could have added `'/'` to that set and no test would have objected. Two tests now assert it, plus one that pins the contents of `PUBLIC_ACCESS_PATHS` itself — widening that set opens the household's private space and is an approval matter, not a refactoring side effect. The page's wording was corrected to match: its readers are signed-in family, not the public. Still unsettled: whether a fixed sample demo is the right first screen for a signed-in member.
- Adjudication of the two long-open branches (2026-09-09). PR #7 (`feature/chad-family-os-core-v0.1`) holds 119 unique files, and almost all are superseded: a v0-generated One-Box UI (`components/ui/*`, `lib/planner.ts`, `lib/mock-*`, `app/api/plan`) that main's Family OS UI replaced, plus a `context/feature-specs/01–23` that is a **separate numbering lineage** — main has its own 01–44 with entirely different content, so nothing was lost. PR #6 is a pre-implementation PRD ("implementation not started") for that same superseded line. PR #4 (dependabot) is stale: it targets `next` 16.2.4→16.2.6 while main runs 16.3.4, so merging it would be a downgrade; `pnpm audit` reports no known vulnerabilities. Its advisory list did include middleware/proxy bypasses, which matters here because `proxy.ts` is the household's only door — main is already past them.
- Google auth minting (Unit 44) recovers the one live asset from that branch. The repository could **use** a refresh token in three places and **mint** one in none, which is the real reason the Drive lane never ran: the tracker had recorded the blocker as "a human with household credentials", but no credentials could be obtained with anything in this repository. The ported tool fixes a defect it carried: the original had no OAuth `state`, so any page open in the operator's browser could call the loopback callback and have the attacker's refresh token written to the owner's file. `state` is checked before the provider's `error` (otherwise someone who does not know the nonce could kill the flow with a bare `?error=`), and a non-callback path is ignored rather than rejected (browsers fetch `favicon.ico` on the same port). Client credentials come from env rather than a file path — the mismatch already corrected once in Unit 41. The output is treated as what it is: mode 0600, a default path `.gitignore` already covers, refusal of any in-repo path that is not a top-level `.env*`, and the token value never printed — confirmation is a sha256 fingerprint.
- Family OS regression is now 643/643 GREEN with `hyodo:check` 5/5.

- **The Drive Outbox lane ran end to end for real on 2026-09-09 (Unit 45).** Every unit from 33 onward had carried the same caveat — *shape-verified, round-trip unverified* — because no session in this repository had ever made a live `drive.files.list` call. That is now retired. A desktop OAuth client was created in the AFO-Kingdom project (the same project as the production web client), a `drive.readonly` refresh token was minted, and the real listing returned the two files that were actually in `10_JAY/04_DORANDORAN_OUTBOX`.
- The authenticated account was verified rather than assumed. `AUTH_OK` appeared without anyone in the session having clicked consent — `open` had launched the flow in a browser window outside the automated tab — which left the one fact that matters unknown: whose Drive the token can read. A token for the wrong account does not fail loudly; it returns an empty folder, and an empty folder looks exactly like a working lane with nothing in it. `drive.about.get(fields: user)` answered `bigbananamusic@gmail.com`, the owner of the outbox folders, and only then did the run proceed.
- Results: test cursor DB first run `accepted=1 skipped=1 cursorAdvanced=true`; second and third runs `accepted=0 skipped=2 cursorAdvanced=false` with the cursor stable at 2 rows. Production Neon after promotion: identical shape, cursor `10_JAY/file/1DUXlKea802AfgdhIQgQbxNaPjHjNjuZ2` and `10_JAY/event/outbox-smoke-2026-09-09-001`, 0 duplicate rows, and `lifecycle_capture`/`candidate`/`task` all still 0 — `outbox:run` writes the cursor and nothing else. `duplicate=0` on the repeat is the stronger result: the file is filtered at plan stage before it is read, so the Drive API is not called for it at all; the `eventId` check is the second line of defence, for a lost cursor, and was not needed.
- The fixture is real. A 261-byte artifact file was created in the lane root and the record's `digest` is that file's actual SHA-256 (byte count matched what Drive reported). `driveFileId` points at the artifact, not at the record's own file — spec 31 says only `driveFileId` and `digest` cross this boundary, so a runner that injected the record's own id would be asserting the record *is* the artifact. Nothing injects it, and that is correct.
- Production migration state was not what the tracker implied: only `0001_lifecycle.sql` had ever been applied, so `drive_outbox_cursor` did not exist and any earlier production run would have failed on a missing table. `0002` was read before applying — `CREATE TABLE IF NOT EXISTS` plus `CREATE INDEX IF NOT EXISTS`, no `DROP`/`TRUNCATE`/`DELETE`/destructive `ALTER` — then applied.
- Unit 43 was proven in production the same day it was written. Its tests compare strings and cannot say whether a real server accepts the pinned value. The household's Neon string carries `sslmode=require`; the pinning rewrote it to `verify-full` and the connection **succeeded** — schema read, migration applied, cursor written. The claim "this asks pg for exactly what pg already does" is no longer only an argument.
- Cron was initially deferred while the outbox had only a processed smoke record. That decision is retired by the production nightly reconcile implementation below; the scheduler now verifies the full read → ingest boundary even when the current workload is empty.
- Daily Capsule v1 landed in PR #68 (`d5752c3`) with migration `0004_daily_capsule.sql`. Production deployment `dorandoran-pytvtheb4` is READY on that SHA, and the migration applied successfully through the production environment runner. The authenticated cron `200` receipt with `capsule.persisted=true` is **UNOBSERVABLE** from this seat because Vercel does not expose `CRON_SECRET` to local command injection; unauthorized cron remains `401`.
- Drive `final_artifact` observations now persist transactionally with handoff ingest in migration `0005_drive_artifact_observation.sql`; Daily Capsule rebuilds only family-scope observations into its privacy-safe Artifact projection. Local proof is 693/693 tests and HyoDo 5/5; production migration and authenticated artifact-bearing cron receipt remain pending this lane's deployment.
- No secret is recorded anywhere in this repository. The mint tool prints a 12-hex SHA-256 fingerprint instead of the refresh token; `.env.local` holds the live credentials at mode `0600` and is covered by `.gitignore`'s `.env*` — both confirmed by measurement, not assumed. The two Drive smoke files are kept: they are harmless (skipped as `already_processed` on every later run) and deleting them is a destructive action nobody asked for.

## Next unit

**DORANDORAN DRIVE OUTBOX E2E — NIGHTLY RECONCILE + DAILY CAPSULE** (2026-09-10). Drive handoff ingest remains production-verified with migration `0003`, secret, deployment, domain alias, unauthorized `401`, and prior authenticated `200` smoke. Daily Capsule v1 now adds migration `0004`, a household-local idempotent sealed projection, and a sealed-first authenticated read route. The new authorized `200` receipt is not claimed from this seat; it remains **UNOBSERVABLE** until a holder of the production cron secret runs it.

Remaining lanes:

1. **Apple Photos human-session boundary.** Create the empty `DoranDoran` album in a real Photos GUI/TCC-authorized session, place only explicitly approved memories into it, then run `pnpm photos:snapshot:refresh` and verify Past Journey/Globe real-data projection. Keep private Photos/Calendar sources disabled on Vercel.
