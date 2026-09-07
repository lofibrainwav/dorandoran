# 14 — JDK Exact Verified Release Bridge

Goal: consume JDK's real verified-release projection without importing private Truth, parent capsules, or JDK internals.

Rules:
- Adapter accepts the real JDK release shape: task + plan + rendererId + verifiedAt.
- Family OS Opportunity uses only safe release fields; it never consumes private source slices or review capsules.
- Release receipt evidence is a bridge receipt, not a claim about original source truth.
- JDK release readiness is implied by successful JDK projection; Family OS must not invent it.
- Family Goal remains open until practice outcome/readback satisfies its own success criteria.
- Direct server-to-server fetch is blocked while JDK requires parent cookie + capsule + same-origin.
- No auth bypass, shared secret copy, or cross-repo private-data import is allowed.
