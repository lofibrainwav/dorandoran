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
