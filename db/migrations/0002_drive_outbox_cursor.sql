-- Drive Outbox cursor (Unit 38): what a run has already read and already ingested.
-- Idempotent: safe to run repeatedly, and safe to run once already applied.

-- One table rather than two so a single multi-row INSERT advances files and events together.
-- Two tables would need a transaction to avoid a half-advanced cursor, and a half-advanced
-- cursor is the one state that silently loses records.
CREATE TABLE IF NOT EXISTS drive_outbox_cursor (
  lane text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('file', 'event')),
  value text NOT NULL,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lane, kind, value)
);

-- Every read is lane-scoped; a cursor shared across lanes would merge three households'
-- dedup sets into one.
CREATE INDEX IF NOT EXISTS drive_outbox_cursor_lane_kind_idx
  ON drive_outbox_cursor (lane, kind);
