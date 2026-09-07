CREATE TABLE IF NOT EXISTS radar_paid_runs (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'CLAIMED', 'RESERVED', 'SETTLED', 'COMPLETED', 'CANCELLED', 'UNCERTAIN')),
  version BIGINT NOT NULL DEFAULT 0,
  fence_token BIGINT NOT NULL DEFAULT 0,
  cap_microusd BIGINT NOT NULL CHECK (cap_microusd > 0),
  reserved_microusd BIGINT NOT NULL DEFAULT 0 CHECK (reserved_microusd >= 0),
  settled_microusd BIGINT NOT NULL DEFAULT 0 CHECK (settled_microusd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_microusd + settled_microusd <= cap_microusd)
);

CREATE TABLE IF NOT EXISTS radar_paid_operations (
  run_id TEXT NOT NULL REFERENCES radar_paid_runs(run_id),
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CLAIMED', 'COMPLETED', 'CANCELLED', 'UNCERTAIN')),
  version BIGINT NOT NULL,
  fence_token BIGINT NOT NULL,
  result_json JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, operation_id)
);

CREATE TABLE IF NOT EXISTS radar_paid_reservations (
  run_id TEXT NOT NULL REFERENCES radar_paid_runs(run_id),
  reservation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'SETTLED')),
  max_microusd BIGINT NOT NULL CHECK (max_microusd > 0),
  actual_microusd BIGINT CHECK (actual_microusd >= 0 AND actual_microusd <= max_microusd),
  fence_token BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, reservation_id)
);
