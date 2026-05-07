-- Sprint 7 Phase 1 Migrations — VétoAI
-- A exécuter sur la DB Railway

DO $$ BEGIN
  CREATE TYPE recurring_frequency AS ENUM ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS recurring_appointments (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id INTEGER REFERENCES patients(id),
  owner_id INTEGER REFERENCES owners(id),
  veterinaire TEXT,
  veterinaire_id TEXT,
  motif TEXT,
  type_rdv TEXT NOT NULL DEFAULT 'CONSULTATION',
  duree_minutes INTEGER NOT NULL DEFAULT 30,
  frequency recurring_frequency NOT NULL DEFAULT 'MONTHLY',
  day_of_week INTEGER,
  time_of_day TEXT NOT NULL DEFAULT '09:00',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE sms_status AS ENUM ('PENDING','SENT','FAILED','DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sms_type AS ENUM ('RAPPEL_J3','RAPPEL_J1','CONFIRMATION','CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sms_log (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  rdv_id INTEGER REFERENCES rendez_vous(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  type sms_type NOT NULL DEFAULT 'CUSTOM',
  status sms_status NOT NULL DEFAULT 'PENDING',
  twilio_sid TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weight_history (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  weight REAL NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consultation_id INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE letter_type AS ENUM ('RELANCE','CONVOCATION','INFORMATION','BILAN','AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS client_letters (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  type letter_type NOT NULL DEFAULT 'AUTRE',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  module TEXT NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_write BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_sms_log_clinic ON sms_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_rdv ON sms_log(rdv_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_patient ON weight_history(patient_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_client_letters_owner ON client_letters(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_clinic ON recurring_appointments(clinic_id, active);
