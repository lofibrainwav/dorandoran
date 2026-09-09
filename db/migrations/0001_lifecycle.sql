-- Family OS core lifecycle tables (A2 persistence).
-- Idempotent: safe to run repeatedly, and safe to run once already applied.

CREATE TABLE IF NOT EXISTS lifecycle_capture (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('personal', 'family', 'professional')),
  kind text NOT NULL,
  stated_text text NOT NULL,
  source text NOT NULL,
  occurred_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL,
  captured_by text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]',
  unknowns jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lifecycle_capture_person_scope_idx
  ON lifecycle_capture (person_id, privacy_scope);

CREATE TABLE IF NOT EXISTS lifecycle_candidate (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('personal', 'family', 'professional')),
  source_capture_id text REFERENCES lifecycle_capture(id),
  proposed_by text NOT NULL,
  opportunity jsonb NOT NULL,
  decision jsonb NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lifecycle_candidate_person_scope_idx
  ON lifecycle_candidate (person_id, privacy_scope);

CREATE TABLE IF NOT EXISTS lifecycle_task (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  privacy_scope text NOT NULL CHECK (privacy_scope IN ('personal', 'family', 'professional')),
  candidate_id text NOT NULL REFERENCES lifecycle_candidate(id),
  block jsonb NOT NULL,
  work_state text NOT NULL,
  authority_ref text NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifecycle_task_candidate_id_key UNIQUE (candidate_id)
);

CREATE INDEX IF NOT EXISTS lifecycle_task_person_scope_idx
  ON lifecycle_task (person_id, privacy_scope);

CREATE INDEX IF NOT EXISTS lifecycle_task_work_state_idx
  ON lifecycle_task (work_state);
