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

## Next unit
Two open lanes, in priority order:
1. Finish the Drive lane's transport half. The contract decisions are done (Drive is SEALED) and the decision layer exists (Units 31/33/34), but nothing yet reads Drive: `drive.readonly` is absent from `google-source-scopes`, the processed `fileId`/`eventId` sets are not persisted, and there is no `/api/lifecycle/drive-outbox` route. Explicit local trigger first; no scheduler, no Drive write.
2. Resolve the macOS Photos human-session boundary: create the empty `DoranDoran` album in a real Photos GUI/TCC-authorized session, place only explicitly approved memories into it, then run `pnpm photos:snapshot:refresh` and verify Past Journey/Globe real-data projection. Keep private Photos/Calendar sources disabled on Vercel.
