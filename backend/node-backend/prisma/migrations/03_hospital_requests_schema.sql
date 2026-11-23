-- Step 1: Add must_change_password to users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Step 2: Create hospital_requests table
CREATE TABLE IF NOT EXISTS hospital_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_name VARCHAR(255) NOT NULL,
  hospital_code VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  registration_number VARCHAR(100),
  bed_capacity INT DEFAULT 50,
  documents_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'PENDING',
  rejection_reason TEXT,
  approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL,
  timeline_json JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Indexes for hospital_requests
CREATE INDEX IF NOT EXISTS idx_hospital_requests_status ON hospital_requests(status);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_user ON hospital_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_requests_code ON hospital_requests(hospital_code);
