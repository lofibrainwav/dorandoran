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
- Family OS regression: 116/116 PASS.
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
- Regression count is 116 tests.

## Next unit
Connect real private calendar reads behind the same operating projection boundary, then bridge Jayden specialist modules without duplicating the learning runtime. Add route/presence/photo adapters one capability at a time.
