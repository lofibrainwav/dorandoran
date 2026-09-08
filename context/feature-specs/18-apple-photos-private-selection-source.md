# Unit 18 — Apple Photos Private Selection Source

## Authority boundary
- First live Photo transport reads only the media items the human has explicitly selected in macOS Photos.
- It does not crawl the whole library, infer a Jayden identity, or create a live-presence claim.
- Transport requests only Photos `id`, `date`, and `location`.
- It never requests filename, description, title, pixels, dimensions, raw EXIF, or filesystem paths.
- The source is local/private only and must never run on Vercel/public runtime.

## Flow
Human selection in Photos → local JXA transport → sanitized `{id,date,location}` → Photo Metadata Adapter → Past Journey Experience.

## Runtime gate
- requires local private Family surface plus `APPLE_PHOTOS_SELECTION_SOURCE=1`
- public/Vercel runtime returns no source and never launches Photos automation
- transport timeout is bounded to 15 seconds

## Acceptance
- selection only; max 100 items per read
- dirty optional date/location metadata is omitted
- output display contains no Apple asset id or canonical evidence/source refs
- read failure returns explicit `failure` plus an empty experience
