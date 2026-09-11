-- Native iPhone companion authorization. Token and pairing-code plaintext are never stored.
CREATE TABLE IF NOT EXISTS apple_photo_pairing (
  pairing_id text PRIMARY KEY,
  library_scope text NOT NULL CHECK (library_scope IN ('family-shared')),
  code_hash text NOT NULL UNIQUE,
  created_by_person_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apple_photo_pairing_active_idx
  ON apple_photo_pairing (code_hash, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS apple_photo_device (
  device_id text PRIMARY KEY,
  library_scope text NOT NULL CHECK (library_scope IN ('family-shared')),
  device_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by_person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NULL,
  revoked_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS apple_photo_device_active_idx
  ON apple_photo_device (library_scope, created_at DESC)
  WHERE revoked_at IS NULL;

