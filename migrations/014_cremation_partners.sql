-- Migration 014: Create cremation_partners table
-- Extracted from runMigrations.ts (sprint4e-cremation)

CREATE TABLE IF NOT EXISTS cremation_partners (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  tarif_individuel NUMERIC(10,2),
  tarif_collectif NUMERIC(10,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cremation_partners_clinic
  ON cremation_partners (clinic_id);
