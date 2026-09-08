# Runtime environment keys (Family OS)

All keys are read server-side only. None is required for the public demo page.

| Key | Purpose | Default / behaviour |
|---|---|---|
| `GOOGLE_WEB_CLIENT_ID` | Google Identity Services web client for `/signin` | required for household access |
| `DORANDORAN_AUTH_SECRET` | HMAC secret for the household session cookie | required for household access |
| `DORANDORAN_HOUSEHOLD_MEMBERS_JSON` | Explicit household membership keyed by Google `sub` | required; parse failure → 503 (fail closed) |
| `DORANDORAN_FAMILY_CALENDAR_ID` | Operational family calendar id | unset → no schedule source |
| `DORANDORAN_CALENDAR_SUBJECT_RULES_JSON` | Event/series → person rules; never title inference | unset → all events unassigned |
| `GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | Server-side Calendar read credentials (Vercel-safe path) | incomplete → schedule source `failure` |
| `DORANDORAN_TIME_ZONE` | Household IANA time zone for week/day boundaries | `America/Los_Angeles`; invalid → resolver throws, `/family` logs and uses the default |
| `DORANDORAN_HOME_COORDINATES` | `"lat,lng"` the globe looks at for Now/Today/Week/Month/Year | `34.05,-118.24`; invalid, or a label set without coordinates → resolver throws, `/family` logs and uses the default. Never a presence claim |
| `DORANDORAN_HOME_LABEL` | Label shown next to the globe | `Los Angeles` (or `Home` when coordinates are set without a label) |
| `DORANDORAN_JDK_BRIDGE_URL` / `DORANDORAN_JDK_BRIDGE_TOKEN` | Delegated JDK bridge for the Learning module status (spec 09) | unset → `Bridge pending` |
| `DORANDORAN_LOG_DENIED_IDENTITY` | Preview-only discovery log of denied Google subjects | ignored outside `VERCEL_ENV=preview` |

Retired 2026-09-08: `DORANDORAN_ACCESS_CODE`, `DORANDORAN_GATE_KEY` (spec 25H).
