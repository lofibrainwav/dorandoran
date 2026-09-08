# Unit 22 — Private Photo Setup Guidance

## Purpose
Turn private photo-source truth into a small local operator action without inventing readiness.

## Boundary
- Input is only `PrivatePhotoJourneyResult | null` plus the configured album label.
- Public/Vercel receives `null` because the private source is already fail-closed there.
- `album-missing` is an action-required state, not GREEN.
- Transport failure stays failure.
- Ready with zero memories is valid and distinct from a missing album.
- Guidance contains no asset ids, evidence refs, file paths, tokens, or credentials.
