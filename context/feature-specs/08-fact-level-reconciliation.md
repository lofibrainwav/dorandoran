# 08 — Fact-level Reconciliation

Goal: resolve only the specific facts that newer authoritative evidence changes.

Rules:
- reconciliation happens only for claims already mapped to the same event/fact;
- never fuzzy-match events by title/time inside this resolver;
- direct official/provider evidence outranks recurring calendar defaults;
- a location override must not silently replace an unrelated time fact;
- newer evidence breaks ties within the same authority tier;
- unresolved equal-authority contradictions remain CONFLICT, never guessed;
- original evidence refs and superseded claim ids stay attached.