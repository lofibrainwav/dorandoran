-- Apple Calendar/Reminders/Shortcuts/Home metadata-only observation ledger.
-- Photos keeps its dedicated stream tables and cursor.
CREATE TABLE IF NOT EXISTS apple_digital_atom_metadata (
  source text NOT NULL CHECK (source IN ('calendar', 'reminders', 'shortcuts', 'home')),
  device_id text NOT NULL,
  event_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, device_id, event_id)
);

CREATE INDEX IF NOT EXISTS apple_digital_atom_active_idx
  ON apple_digital_atom_metadata (source, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS apple_digital_atom_cursor (
  source text NOT NULL CHECK (source IN ('calendar', 'reminders', 'shortcuts', 'home')),
  device_id text NOT NULL,
  cursor text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (source, device_id)
);

CREATE TABLE IF NOT EXISTS apple_digital_atom_receipt (
  source text NOT NULL CHECK (source IN ('calendar', 'reminders', 'shortcuts', 'home')),
  device_id text NOT NULL,
  batch_digest text NOT NULL,
  cursor text NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (source, device_id, batch_digest)
);

CREATE INDEX IF NOT EXISTS apple_digital_atom_receipt_cursor_idx
  ON apple_digital_atom_receipt (source, device_id, cursor);
