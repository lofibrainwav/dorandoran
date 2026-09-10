-- 영속화된 개인정보 보호형 Daily Capsule projection.
-- 가정 키를 분리해 향후 한 배포가 여러 가정을 맡아도 경계를 보존한다.
CREATE TABLE IF NOT EXISTS family_daily_capsule (
  household_key text NOT NULL,
  capsule_date date NOT NULL,
  version integer NOT NULL,
  capsule jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_key, capsule_date)
);

CREATE INDEX IF NOT EXISTS family_daily_capsule_date_idx
  ON family_daily_capsule (capsule_date DESC);
