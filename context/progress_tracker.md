# Progress Tracker

## Active handoff — 2026-09-09

Units 29–32 landed on `main` today, all through PR + Greenfield Quality + HyoDo shadow; `main` push now also triggers CI (`26fbe0d`).

- Unit 29 ([planner recommendations](feature-specs/29-planner-recommendations.md)) `9b86703` — gap-fitting wish recommendations, lazy-loaded in `/family` with fallback to auto-placement.
- Unit 30 ([artifact registry / night reconcile / daily capsule](feature-specs/30-artifact-registry-night-reconcile-daily-capsule.md)) `93da1d0` — pure read model; first consumer is Unit 31.
- Unit 32 ([family coordination anchor](feature-specs/32-family-coordination-anchor.md)) PR #28 merge `97490bb` — ported from the 2026-09-07 WIP branch `feature/chad-family-os-core-v0.1` (122 behind main, unmergeable); only the pure module moved.
- Unit 31 ([Drive handoff intake](feature-specs/31-drive-handoff-intake.md)) PR #29 merge `fbf3ffd` — the code-side receiver for the provider-neutral Google Drive AI contract (`00_START_HERE_DORANDORAN_AI_README`, MOC 00/10/20, `DORANDORAN_HANDOFF_TEMPLATE` v1, 2026-09-09). Independent adversarial review (FAIL 3 / WARN 2) was repaired before merge. Drive-side reconciliation findings (field-name drift, `child-controlled`, missing `digest`) are recorded in bb `02-Projects/kingdom-os/dorandoran/2026-09-09-drive-contract-reconciliation.md` and await the Drive contract owner.

Regression count is 522 tests. Unauthenticated `/` and `/family` still 307 → `/signin`; authenticated UI was not re-observed today. The historical notes below do not supersede this handoff.

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

## Next unit
Four open lanes. The first two are decisions rather than code, and both were surfaced by measuring the live site on 2026-09-09:

0a. **Decide whether `/` is public.** `app/page.tsx` labels itself "Public demo · fixed sample data" and declares `canonical: https://dorandoran.link`, but `PUBLIC_ACCESS_PATHS` holds only `/signin` and `/api/auth/google`, so production `/` returns 307 to `/signin` and no unauthenticated visitor can ever see that page. The tests for `decideHouseholdAccess` assert `/family`, `/signin` and `/unlock` — never `/` — so nothing records a decision to gate the home page; it followed from 25H's "everything else redirects". Either `/` joins the public set or the page stops calling itself a public demo. This is an access-policy question about a family's private space, not a defect to quietly fix.

0b. **Decide who runs the Drive outbox.** `runDriveOutboxSession` has exactly two call sites: its tests and `scripts/drive-outbox-run.mjs`. There is no route and no `vercel.json`, therefore no cron. Units 33–42 are code that only runs when a human runs it, and dorandoran.link has never executed the outbox at all. Before "one real record flows" can mean anything durable, the lane needs a production surface — or an explicit decision that it stays a hand-run local tool.

1. **Put one real handoff record in an outbox and watch it land.** The lane has now been read for real and hardened against what that read exposed (Unit 42), but no actual record has ever flowed: the folders contain only the template. What remains is a Drive **write** — dropping one filled record into `04_DORANDORAN_OUTBOX` — plus a run with real credentials. Until that happens the transport is still *shape-verified, round-trip unverified*. Every layer is built, merged, and green (Units 33, 34, 36–41), and the honest state of the transport is *shape-verified, round-trip unverified*: no session in this repository has ever made a real `drive.files.list` call. What is needed is a human with household credentials running `npm run outbox:run -- --lane=10_JAY` after setting `DRIVE_OUTBOX_CLIENT_ID`, `DRIVE_OUTBOX_CLIENT_SECRET`, `DRIVE_OUTBOX_REFRESH_TOKEN`, `DRIVE_OUTBOX_FOLDER_<LANE>` and running `db:migrate` for `0002_drive_outbox_cursor.sql`. The outbox folder ids as observed on 2026-09-09: family `1qMt03JZj5pt4dizgShWvla5Q5_i7tM9k`, jay `1uXB11SXmALCVNw5ewnlUtpkzCXpQnx17`, shared `1ZS7UPzP6TN4PDUAnbD1FiNELupuL9vuV`. Read-only; no scheduler, no Drive write. Whatever that run reveals is the next unit.
2. Resolve the macOS Photos human-session boundary: create the empty `DoranDoran` album in a real Photos GUI/TCC-authorized session, place only explicitly approved memories into it, then run `pnpm photos:snapshot:refresh` and verify Past Journey/Globe real-data projection. Keep private Photos/Calendar sources disabled on Vercel.
