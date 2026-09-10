-- Durable idempotency ledger for the scheduled Drive handoff -> lifecycle ingest.
-- The ledger and lifecycle rows are written in one transaction by the cron consumer.
CREATE TABLE IF NOT EXISTS drive_handoff_ingest (
  lane text NOT NULL,
  file_id text NOT NULL,
  event_id text NOT NULL,
  capture_id text NOT NULL,
  candidate_id text NULL,
  ingested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lane, event_id),
  UNIQUE (lane, file_id)
);

CREATE INDEX IF NOT EXISTS drive_handoff_ingest_event_idx
  ON drive_handoff_ingest (event_id);

