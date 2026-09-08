ALTER TABLE radar_paid_runs
  ADD COLUMN IF NOT EXISTS lifecycle_mode TEXT NOT NULL DEFAULT 'SINGLE_OPERATION'
  CHECK (lifecycle_mode IN ('SINGLE_OPERATION', 'MULTI_OPERATION'));

CREATE INDEX IF NOT EXISTS radar_paid_runs_lifecycle_status_idx
  ON radar_paid_runs (lifecycle_mode, status);
