-- Drive handoff 아티팩트 관찰값. provider가 정본이며,
-- lifecycle projection에 필요한 검증된 관찰값만 보존한다.
CREATE TABLE IF NOT EXISTS drive_artifact_observation (
  lane text NOT NULL,
  event_id text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('personal', 'family', 'professional')),
  artifact_id text NOT NULL,
  kind text NOT NULL,
  digest text NOT NULL,
  observed_at timestamptz NOT NULL,
  state text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (lane, event_id)
);

CREATE INDEX IF NOT EXISTS drive_artifact_observation_date_idx
  ON drive_artifact_observation (observed_at);

CREATE INDEX IF NOT EXISTS drive_artifact_observation_artifact_idx
  ON drive_artifact_observation (artifact_id);
