-- Phase 0C — Soft Delete sur tables critiques
-- Migration: ajout de deleted_at TIMESTAMPTZ sur patients, owners, rendez_vous,
--            consultations, factures, ordonnances
-- Appliquer sur Railway via psql ou l'interface DB

-- ─── patients ────────────────────────────────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_deleted_at
  ON patients (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── owners (propriétaires) ──────────────────────────────────────────────────
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_owners_deleted_at
  ON owners (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── rendez_vous ─────────────────────────────────────────────────────────────
ALTER TABLE rendez_vous
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_rendez_vous_deleted_at
  ON rendez_vous (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── consultations ───────────────────────────────────────────────────────────
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_deleted_at
  ON consultations (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── factures ────────────────────────────────────────────────────────────────
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_factures_deleted_at
  ON factures (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── ordonnances ─────────────────────────────────────────────────────────────
ALTER TABLE ordonnances
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ordonnances_deleted_at
  ON ordonnances (clinic_id, deleted_at)
  WHERE deleted_at IS NULL;

-- ─── Notes d'application ─────────────────────────────────────────────────────
-- 1. Toutes les queries SELECT doivent filtrer: WHERE deleted_at IS NULL
--    (géré par isNull(table.deletedAt) dans Drizzle)
-- 2. Les suppressions doivent mettre à jour: SET deleted_at = NOW()
--    (jamais de DELETE FROM en prod sur ces tables)
-- 3. Les FOREIGN KEYS existantes ne sont pas modifiées (soft-delete parent
--    laisse les enfants intacts — comportement voulu pour audit)
