# Unit 26 — Household Week Completeness

## Problem and behavior

The signed-in Family Week used the child's explicitly assigned, timed observations for its grid. Events for other people, events without a subject rule, and all-day calendar facts disappeared even though the operational family calendar contained them.

The operational source now returns a separate `householdObservations` stream for the week grid. The existing person-scoped `observations` and NOW/NEXT read model retain their explicit subject requirement. Personal calendars are not added to the operational source.

## Contracts

- Show all timed and all-day facts from the configured operational calendar within the current Sunday-first week.
- Unresolved subjects stay unassigned and display `Family · person unassigned`. Do not infer people from titles or calendar ownership.
- Display resolved non-anchor subjects as `Family member`; do not expose internal person IDs or invent display names.
- All-day dates retain their calendar date, have an exclusive end date, and sort before timed events. As with the existing timed projection, a spanning event appears once on its first overlapping day.
- Reject invalid or reversed all-day ranges. An invalid operational payload marks the source unavailable instead of silently reporting an incomplete week as complete.
- An unavailable source renders `Schedule unavailable.` in the day cells. Only a successfully observed empty day renders `No scheduled facts.`
- Credentials, provider descriptions, calendar/evidence IDs, and internal non-anchor person IDs do not appear in the rendered week.
- The legacy local person-source fallback keeps its existing timed-only scope; it does not claim to inventory the operational household calendar.

## Verification and handoff — 2026-09-08

Base: `265d20417404891248e69d7f2bd9334219d0d951`.
Branch: `feat/family-week-shows-all-household-facts`.
Implementation remains uncommitted in the inherited worktree.

- Reproduced Fable's failing mixed-calendar assertion. Its person-isolation assertion now targets `readModel` and `observations`; separate assertions require all household facts to remain visible.
- RED then GREEN for malformed operational payloads and invalid/exclusive all-day date ranges.
- Focused adapter, projection, and actual server-page render tests: 17 passed on Node 24.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH pnpm verify`: safety scan passed; typecheck, production build, full tests, production dependency audit, and lint all passed (5/5 observed).
- The new untracked render test was additionally scanned by an explicit `hyodo safe <file> --strict` call because the default diff scan covered tracked files only.
- `git diff --check`: passed.
- Read-only local-calendar comparison at `2026-09-08T19:00:00.405Z`, week starting `2026-09-06`: 11 raw timed events, 11 projected household items. No titles, IDs, locations, or credentials were printed. No all-day events existed in that sample; all-day evidence is controlled regression coverage.

## Release boundary

No push, PR creation, merge, deployment, or credential change was performed for this unit. Production behavior remains unverified for this patch. Obtain publication/deployment authority, publish the reviewed diff, verify CI for its exact head, and check the authenticated production week after deployment.

Separate JDK work: PR #7 remains open at `41a9d47e0dc867cb402749c5701b305b2ee658d9`. Both GitHub quality checks passed when read back. Local verification: 137 tests passed, one live-provider test skipped; typecheck/build and public bundle scan passed. Bridge token configuration and delegated release transport are separate remaining work; this calendar fix does not make the Learning bridge Connected.
