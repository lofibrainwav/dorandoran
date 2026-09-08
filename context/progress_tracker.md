# Progress Tracker

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
- Current verified JDK release transport is parent-session/capsule/same-origin bound with no delegated bridge, so the Learning module truthfully renders `Bridge pending` locally instead of pretending it is connected.
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
- Canonical public website metadata is `https://dorandoran.link`; the domain is now attached to Vercel project `v0-one-box`.
- `dorandoran.link` DNS is verified and configured correctly on Vercel; the apex now resolves to the approved Vercel A record and HTTPS is live.
- Calendar range transport now fails closed when a next-page token indicates truncation.
- Private `/family` runs week and year reads in parallel, while public/Vercel still cannot enable the private surface.
- Regression count is 188 tests.
- GREEN Preview for HEAD `42078ba` was promoted to Production after explicit user approval.
- Live readback is GREEN: `https://dorandoran.link/` and `/family` both return HTTP 200.
- Public `/family` exposes no private local-source badge, Photos setup state, credential path, Apple evidence ref, or private snapshot path.
- DoranDoran Site Password Gate is live in Production: unauthenticated `/` and `/family` redirect to `/unlock` with no-store + noindex headers.
- Site access code and independent gate key are stored only as Vercel Production Secrets; the real access code is absent from tracked files and never enters the authorization cookie.
- Unlock page is public-safe and noindex; private Family/Photos state remains hidden before authorization.
- Private Photo Setup Guidance now distinguishes ready, action-required album setup, and source failure without exposing private refs.
- Local production smoke exposed a performance blocker: live `osxphotos` album reads take about 17.2s cold (about 9.9s with `_skip_searchinfo`), so Photos DB work must leave the HTTP render path.
- Private Photo Snapshot now moves heavy Photos DB reads to explicit local refresh; `/family` reads only a versioned privacy-safe snapshot.
- Real refresh produced a 261-byte mode-0600 snapshot in about 20.5s with `partial/album-missing`; no asset/evidence/source refs or credential paths were persisted.
- Clean production `/family` smoke is HTTP 200 in 0.744s with snapshot truth visible and no private path/ref leakage.

## Next unit
Resolve the remaining macOS Photos human-session boundary: create the empty `DoranDoran` album in a real Photos GUI/TCC-authorized session, place only explicitly approved memories into it, then run `pnpm photos:snapshot:refresh` and verify Past Journey/Globe real-data projection. Keep private Photos/Calendar sources disabled on Vercel.
