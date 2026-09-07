# 16 — Google Read-only Source Scopes

Goal: authorize a family source once for the read-only Google services it actually needs.

Rules:
- Calendar uses calendar.readonly only.
- Gmail uses gmail.readonly only.
- Multiple requested services are deduplicated into one OAuth consent flow.
- Unknown services fail closed.
- Token files remain source-isolated and repo-external with mode 0600.
- Existing Family/Julie calendar-only token is not broadened automatically.
- Jayden can opt into Calendar + Gmail read-only in one authorization.
- No send, write, modify, contacts, drive, or profile scopes are requested.
