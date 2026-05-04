-- Migration 007: Workflow dual-phase IA pour consultations
-- Flux anamnese -> examen clinique -> synthese finale

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'ANAMNESE',
  ADD COLUMN IF NOT EXISTS anamnese_ia TEXT,
  ADD COLUMN IF NOT EXISTS examen_ia TEXT,
  ADD COLUMN IF NOT EXISTS examens_complementaires_valides TEXT,
  ADD COLUMN IF NOT EXISTS synthese_ia TEXT;

CREATE INDEX IF NOT EXISTS idx_consultations_phase ON consultations(phase);
