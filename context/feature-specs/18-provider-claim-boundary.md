# 18 — Provider Claim Boundary

Goal: promote only verified, explicit provider observations into reconciliation claims.

Rules:
- Email evidence alone never implies `direct_official`.
- Sender identity must match a verified provider email or domain.
- Observation must point to the exact private Gmail evidenceRef.
- Ambiguous observations produce no FactClaim.
- `cancelled` requires a boolean; other supported facts require non-empty strings.
- Output is a small FactClaim only: no sender name, subject, snippet, body, or raw source text.
- Claim observedAt comes from the source envelope, not model time.
- Provider claims remain separate by fact kind; start/location/cancelled never overwrite one another directly.
