# Unit 23 — Private Photo Snapshot

## Purpose
Remove heavy Photos DB work from the `/family` HTTP render path.

## Boundary
- Refresh is an explicit local operation and may run the slow private photo transport.
- HTTP rendering reads only one small privacy-safe snapshot file.
- Snapshot path is explicit local configuration; no repository or Vercel default exists.
- Snapshot contains only `PrivatePhotoJourneyResult` display truth plus `generatedAt` and schema version.
- No asset ids, evidence refs, source refs, file paths, raw EXIF, or credentials are persisted.
- Missing, invalid, or stale snapshots fail closed and do not render old memories as current.
- Public/Vercel runtime never reads or writes the private snapshot.
