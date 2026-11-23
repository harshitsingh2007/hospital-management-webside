-- Step 1: Remove existing duplicate ticket_id rows in service_logs, keeping latest
DELETE FROM service_logs a
USING service_logs b
WHERE a.id < b.id 
  AND a.ticket_id = b.ticket_id;

-- Step 2: Enforce Idempotency via UNIQUE constraint on ticket_id
ALTER TABLE service_logs 
  DROP CONSTRAINT IF EXISTS uq_service_logs_ticket_id;
ALTER TABLE service_logs 
  ADD CONSTRAINT uq_service_logs_ticket_id UNIQUE (ticket_id);

-- Step 3: Add data_quality column to service_logs
ALTER TABLE service_logs 
  ADD COLUMN IF NOT EXISTS data_quality VARCHAR(50) DEFAULT 'actual';

-- Step 4: Add feature_snapshot to tickets
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS feature_snapshot JSONB DEFAULT '{}'::jsonb;

-- Step 5: Add per-hospital learning flags to hospitals
ALTER TABLE hospitals 
  ADD COLUMN IF NOT EXISTS allow_global_learning BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_learning_enabled BOOLEAN DEFAULT true;

-- Step 6: Create model_training_runs table
CREATE TABLE IF NOT EXISTS model_training_runs (
  id SERIAL PRIMARY KEY,
  hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
  tenant_code VARCHAR(100) NOT NULL,
  version VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  promoted BOOLEAN DEFAULT false,
  promotion_reason TEXT DEFAULT '',
  data_source VARCHAR(100) DEFAULT 'service_logs',
  training_rows INT DEFAULT 0,
  mae FLOAT DEFAULT 0.0,
  baseline_mae FLOAT DEFAULT 0.0,
  mape FLOAT DEFAULT 0.0,
  r2_score FLOAT DEFAULT 0.0,
  training_window_start TIMESTAMPTZ,
  training_window_end TIMESTAMPTZ,
  model_path VARCHAR(500) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index for non-overlapping runs
DROP INDEX IF EXISTS idx_one_running_run_per_tenant;
CREATE UNIQUE INDEX idx_one_running_run_per_tenant 
  ON model_training_runs(tenant_code) 
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_model_training_runs_hosp ON model_training_runs(hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_training_runs_tenant ON model_training_runs(tenant_code, created_at DESC);
