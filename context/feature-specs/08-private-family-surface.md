# G7 — Private Family Surface

Goal: let the local Family OS surface read the verified private Calendar projection without ever exposing it on the public/Vercel surface by default.

## Gate
- private operating data renders only when `CHAD_PRIVATE_LOCAL_UI=1`
- Vercel/public runtime is always blocked from this local-only path
- missing private config degrades to the normal Family Week shell
- no OAuth token, client secret, calendar id, raw description, or address enters client props

## Flow
Local-only gate → Private Calendar Operating Source → Family Operating Read Model → existing Hero → Family Week.

## Truth rules
- current/next schedule comes from the read model only
- Calendar place remains Scheduled, never Live
- UNKNOWN remains visible when no current event or location exists
- WATCH/HANDOFF stay separate structured projections

## Acceptance
- gate tests RED then GREEN
- build succeeds with no local env present
- local readback can render the private model when explicitly enabled
- Vercel/default route remains privacy-safe
