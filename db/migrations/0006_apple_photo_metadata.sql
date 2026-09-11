-- PhotoKit metadata-only projection. Raw photo bytes, thumbnails, and EXIF blobs are never stored.
CREATE TABLE IF NOT EXISTS apple_photo_metadata (
  library_scope text NOT NULL CHECK (library_scope IN ('family-shared')),
  cloud_id text NOT NULL,
  device_id text NOT NULL,
  captured_at timestamptz NOT NULL,
  modified_at timestamptz NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'live_photo', 'unknown')),
  latitude double precision NULL CHECK (latitude >= -90 AND latitude <= 90),
  longitude double precision NULL CHECK (longitude >= -180 AND longitude <= 180),
  observed_at timestamptz NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (library_scope, cloud_id),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX IF NOT EXISTS apple_photo_metadata_active_idx
  ON apple_photo_metadata (library_scope, captured_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS apple_photo_cursor (
  library_scope text NOT NULL CHECK (library_scope IN ('family-shared')),
  device_id text NOT NULL,
  cursor text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (library_scope, device_id)
);

CREATE TABLE IF NOT EXISTS apple_photo_event_receipt (
  library_scope text NOT NULL CHECK (library_scope IN ('family-shared')),
  device_id text NOT NULL,
  batch_digest text NOT NULL,
  cursor text NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (library_scope, device_id, batch_digest)
);

CREATE INDEX IF NOT EXISTS apple_photo_event_receipt_cursor_idx
  ON apple_photo_event_receipt (library_scope, device_id, cursor);
