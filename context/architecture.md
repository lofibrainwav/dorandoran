# Architecture

Layers:
1. `lib/family-os` — pure domain contracts and deterministic decisions.
2. server integrations — Google/JDK/private source adapters.
3. read models — privacy-safe Family Week projections.
4. UI — DOM/CSS utility interface.
5. optional hero — isolated Three.js/WebGPU enhancement.

Boundaries:
- raw Gmail, OAuth tokens, private source text, and credentials never cross into client projections.
- Hero failure must not affect `/family`.
- Personal schedules remain person-owned truth; Family coordination is a projection.
- No DB is required for the first vertical slice.
- No external write/send action is enabled in the first vertical slice.

Runtime baseline:
- Node 24 LTS
- Next 16.3.4 / React 19.2
- Tailwind 4
- TypeScript and ESLint pinned to the newest peer-compatible versions

## Universal context grammar
- External ecosystems enter through `ContextAdapter` contracts and a capability registry.
- Canonical observations express only known WHO / WHAT / WHEN / WHERE / WHY / HOW fields.
- Provider payloads never become UI contracts.
- Family lenses `jin|seon|mi|in|hyo` remain separate evidence dimensions; no family integrity score is computed.
- `yeong` is continuity over time, not a sixth UI card: Past → Year → Month → Week → Today → Now.
- `PresenceObservation.scheduled` and `confirmed_live` are distinct states.
- MapLibre is a geographic presentation layer. Future map/route providers supply evidence through adapters.

## Expansion sockets
- Time: calendar/event providers.
- Place: map/place/route providers.
- Presence: explicit authorized device/location observations.
- Media/Memory: photo/file providers; future Past Journey projection.
- Education: JDK and future school/classroom providers.
- Communication: mail/message providers.
- Device automation: shortcut/event push adapters.
