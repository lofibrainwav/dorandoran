# 02 — Google Calendar Source Adapter

Goal: normalize a Google Calendar event payload into the provider-neutral `NormalizedCalendarEvent` consumed by Unit 1.

Design decisions:
- Adapter only; no OAuth implementation, API route, database, UI, or background worker.
- Match fields observed from the real Google Calendar connector payload.
- Preserve source identity and URL as evidence metadata without copying private payloads into public fixtures.
- Required malformed identity/time fields fail clearly; optional dirty fields are omitted.
- Calendar description is preserved as source text but never auto-decomposed into tasks.

Implementation:
- Add a narrow `GoogleCalendarEventPayload` input contract.
- Add `normalizeGoogleCalendarEvent(payload, context)` under `lib/family-os/`.
- Context supplies calendar ID and `observedAt`; do not call `Date.now()` inside normalization.
- Default normalized events to protected.
- Recurring event lineage may be preserved as recurrence metadata.

Verification:
- RED tests first for timed event, recurring lineage, missing optional location, and malformed required input.
- Pipe one normalized mock event into `decomposeCalendarEvent` to verify adapter/core compatibility.
- Keep all prior tests and `pnpm lint`, `pnpm typecheck`, `pnpm build`, production audit GREEN.

Out of scope: Google auth, network fetch, calendar write, provider override policy, map, UI.
