# Unit 14 — Photo Metadata Historical Evidence Adapter

## Source law
- Photo metadata is historical evidence for Memory/Past Journey, not live tracking.
- Raw pixels, file paths, thumbnails, and raw EXIF blobs stay outside canonical Family OS observations.
- Capture time, explicit place identity, and coordinates may become memory evidence when the source actually supplies them.
- Missing capture time/place remains unknown; no trip or place name is invented.
- Publishing/blog/yearbook remains a separate future consent boundary.

## Flow
Photo source → metadata adapter → ContextObservation(kind=memory) → Past Journey → display projection.

## Acceptance
- provider-neutral adapter; no Apple/Google branch in core
- dirty optional metadata is omitted, not promoted
- invalid required evidence identity fails closed
- extra raw photo fields cannot leak into normalized observation
- adapter never emits live-presence semantics
