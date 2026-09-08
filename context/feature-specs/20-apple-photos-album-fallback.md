# Unit 20 — Apple Photos Designated Album Fallback

## Purpose
Use one explicitly named Photos album as a fallback when Photos `selection` scripting is too slow or flaky.

## Authority boundary
- The album name must be explicitly configured.
- No album-name discovery is exposed to the app.
- No whole-library result may become Family OS memory.
- Only UUID/date/location are emitted from the transport.
- Public/Vercel runtime remains blocked.

## Runtime
- `APPLE_PHOTOS_ALBUM_NAME` enables album mode only on the local private surface.
- Transport uses pinned `osxphotos==0.76.1` through `uv`.
- Reads are bounded to at most 100 items.
- Missing/empty album returns a valid empty metadata set.
- Transport errors fail closed.

## Flow
Configured album → osxphotos DB query → sanitized metadata → PhotoMetadataAdapter → Past Journey Experience.
