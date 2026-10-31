-- Create broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
  id VARCHAR(100) PRIMARY KEY,
  hospital_code VARCHAR(100) NOT NULL DEFAULT 'all',
  type VARCHAR(50) NOT NULL DEFAULT 'notice',
  severity VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sound BOOLEAN NOT NULL DEFAULT true,
  target_surfaces JSONB NOT NULL DEFAULT '{"patient_portal": true, "doctor_desk": true, "staff_desk": true, "kiosk_display": true}'::jsonb,
  duration_minutes INT NOT NULL DEFAULT 30,
  scheduled_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_by_user_id INT,
  created_by_name VARCHAR(255),
  dismissed_by VARCHAR(255),
  dismissed_at TIMESTAMPTZ,
  delivered_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_hospital_code ON broadcasts(hospital_code);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);

