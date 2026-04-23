-- =============================================================================
-- Rollback migration 005 — retour FK simples sur `id`.
--
-- Usage :
--   psql "$DATABASE_URL" -f 005_composite_fk.down.sql
--
-- ⚠️ À n'exécuter que si la 005 up a été appliquée ET que tu veux revenir
-- en arrière. Les données restent intactes — on ne change que les contraintes.
-- =============================================================================

BEGIN;

-- 1) Drop FK composites
ALTER TABLE patients              DROP CONSTRAINT IF EXISTS patients_clinic_owner_fkey;
ALTER TABLE consultations         DROP CONSTRAINT IF EXISTS consultations_clinic_patient_fkey;
ALTER TABLE actes_consultations   DROP CONSTRAINT IF EXISTS actes_consultations_clinic_consultation_fkey;
ALTER TABLE factures              DROP CONSTRAINT IF EXISTS factures_clinic_consultation_fkey;
ALTER TABLE ordonnances           DROP CONSTRAINT IF EXISTS ordonnances_clinic_consultation_fkey;

-- 2) Drop les UNIQUE (clinic_id, id)
ALTER TABLE owners          DROP CONSTRAINT IF EXISTS owners_clinic_id_id_key;
ALTER TABLE patients        DROP CONSTRAINT IF EXISTS patients_clinic_id_id_key;
ALTER TABLE consultations   DROP CONSTRAINT IF EXISTS consultations_clinic_id_id_key;

-- 3) Drop index de support (sans CONCURRENTLY car dans la transaction)
DROP INDEX IF EXISTS patients_clinic_owner_idx;
DROP INDEX IF EXISTS consultations_clinic_patient_idx;
DROP INDEX IF EXISTS actes_clinic_consultation_idx;
DROP INDEX IF EXISTS factures_clinic_consultation_idx;
DROP INDEX IF EXISTS ordonnances_clinic_consultation_idx;

-- 4) Recréer les FK simples (même noms qu'avant la 005)
ALTER TABLE patients
  ADD CONSTRAINT patients_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES owners (id) ON DELETE RESTRICT;

ALTER TABLE consultations
  ADD CONSTRAINT consultations_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT;

ALTER TABLE actes_consultations
  ADD CONSTRAINT actes_consultations_consultation_id_fkey
  FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE CASCADE;

ALTER TABLE factures
  ADD CONSTRAINT factures_consultation_id_fkey
  FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE SET NULL;

ALTER TABLE ordonnances
  ADD CONSTRAINT ordonnances_consultation_id_fkey
  FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE CASCADE;

COMMIT;
