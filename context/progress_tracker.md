# Progress Tracker

Active subsystem: Calendar source registry and reconciliation.
Active feature spec: `context/feature-specs/07-multi-account-calendar-sources.md`.

Reality now:
- Units 1–6 are GREEN and Unit 6 is pushed remotely.
- Family Calendar live read works through isolated read-only local OAuth.
- Multi-account source registry is implemented with per-source token paths.
- Local `/family` degrades honestly to PARTIAL when one configured source is unavailable.
- Family source remains live while Jayden source awaits its own token.
- Matching titles/times are never auto-deduplicated; source evidence stays namespaced.
- Public preview remains credential-free and uses generic fallback only when no live config exists.