# Unit 12 — Past Journey Memory Socket

## Product law
- Past Journey is the farthest time zoom, not a separate photo app.
- Photos, trips, and place memories arrive through adapters into canonical ContextObservation records.
- A photo can support memory truth, but raw pixels, file paths, and EXIF payloads do not enter the Family OS client projection.
- Unknown place or date remains unknown; the system never invents a trip.

## Projection
- Input: canonical observations with `kind: memory` and explicit who/when/where.
- Subject filtering uses person ids only.
- Memories with the same explicit placeRef cluster together.
- Coordinate-backed clusters may appear on the Past globe.
- Unlocated memories remain countable but cannot become map markers.
- Display projection exposes place label, coordinates, date span, and count only.
