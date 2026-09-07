# 17 — Private Gmail Source Boundary

Goal: ingest Gmail evidence without leaking raw message content into FamilyBlock, public fixtures, or recommendation projections.

Rules:
- Gmail REST payload is normalized into a private server-side envelope.
- Stable evidenceRef uses account/source identity + Gmail message id.
- Header access is case-insensitive and explicit.
- Raw body/snippet may exist only in the private envelope and must never be copied by the safe projection.
- Public/safe projection contains message id, observed time, sender domain/category hints only when explicitly requested, and evidenceRef.
- Fact extraction is a separate boundary; envelope normalization never invents schedule claims.
- Missing/invalid message id fails closed.
- No Gmail write/send/modify scopes or actions are introduced.
