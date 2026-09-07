# 05 — Live Family Week Source

Goal: render the authorized local Family Calendar on `/family` without exposing family data in public preview environments.

Rules:
- Family week is Sunday 00:00 through next Sunday 00:00, exclusive.
- Local live mode requires explicit client path, token path, and target calendar ID.
- Missing live config is not an error; public preview falls back to generic demo data.
- Live credentials and family event contents never enter Git fixtures or logs.
- Provider raw data is normalized before FamilyBlock decomposition.
