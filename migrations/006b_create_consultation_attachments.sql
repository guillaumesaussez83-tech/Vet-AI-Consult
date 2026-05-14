-- Migration 006b: Create consultation_patients and consultation_attachments base tables
-- Extracted from runMigrations.ts (sprint4c-multi-animaux)
-- PREREQUISITE for migration 008 (which ALTERs consultation_attachments)
-- clinic_id included upfront for multi-tenant isolation

CREATE TABLE IF NOT EXISTS consultation_patients (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consultation_id, patient_id)
);

CREATE TABLE IF NOT EXISTS consultation_attachments (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  clinic_id TEXT,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  data_base64 TEXT,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_patients_consult
  ON consultation_patients(consultation_id);
