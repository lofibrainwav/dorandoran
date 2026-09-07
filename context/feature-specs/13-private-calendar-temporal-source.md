# Unit 13 — Private Calendar Temporal Source

## Goal
Feed Month and Year from the same authorized private Calendar source used by Today/Now.

## Rules
- Source-to-person mapping remains explicit by person id.
- The Year read window is computed from the requested IANA time zone, not the host time zone.
- A single bounded year read supplies both Month and Year projections.
- Raw calendar payloads stay server-only.
- Client receives only `TemporalGridDisplayProjection`; evidence refs never cross the display boundary.
- Source failure yields unavailable/failed temporal state instead of invented counts.
- Public/Vercel runtime remains unable to enable the private Family surface.

## Efficiency
- Private `/family` may run current-week and year-range reads in parallel because they are independent reads.
- Calendar transport must fail closed if a bounded response is truncated instead of silently claiming completeness.
