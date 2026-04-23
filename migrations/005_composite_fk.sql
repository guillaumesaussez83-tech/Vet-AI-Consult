-- =============================================================================
-- Migration 005 — Foreign Keys composites (clinic_id, id)
-- =============================================================================
--
-- Problème résolu (P1-5) :
-- Aujourd'hui les FK sont sur `id` seul. Un bug applicatif qui oublierait un
-- `WHERE clinic_id = ?` peut JOIN une ligne d'une autre clinique sans que la
-- base proteste. Les FK composites garantissent qu'une consultation ne peut
-- référencer qu'un patient de la MÊME clinic_id.
--
-- Stratégie :
--  1. Ajouter un UNIQUE (clinic_id, id) sur chaque table racine (owners,
--     patients, consultations...).
--  2. Drop les FK simples existantes.
--  3. Recréer les FK en composite (clinic_id, id).
--
-- ⚠️ BREAKING CHANGE pour l'ORM :
-- Drizzle doit déclarer les relations avec les 2 colonnes. À mettre à jour
-- dans `lib/db/src/schema/*.ts` (voir section "Post-migration" en bas).
--
-- ⚠️ PRÉREQUIS :
-- AUCUNE ligne ne doit violer l'invariant "la FK pointe vers la même clinic".
-- Le bloc de vérification ci-dessous s'exécute d'abord et ABORT si on trouve
-- des incohérences — pas de correction silencieuse.
--
-- Durée estimée : quelques secondes à quelques minutes selon le volume (les
-- ADD CONSTRAINT prennent un verrou ACCESS EXCLUSIVE bref sur chaque table).
--
-- Rollback : voir `005_composite_fk.down.sql`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) GATE — vérifier qu'aucune ligne ne viole l'invariant multi-tenant.
--    Si violations trouvées → RAISE EXCEPTION → ROLLBACK automatique.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  -- patients → owners : patient.owner_id doit pointer owner de même clinic
  SELECT COUNT(*) INTO v_count
  FROM patients p
  JOIN owners o ON o.id = p.owner_id
  WHERE o.clinic_id IS DISTINCT FROM p.clinic_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Incohérence multi-tenant : % patient(s) pointent vers un owner d''une autre clinic', v_count;
  END IF;

  -- consultations → patients
  SELECT COUNT(*) INTO v_count
  FROM consultations c
  JOIN patients p ON p.id = c.patient_id
  WHERE p.clinic_id IS DISTINCT FROM c.clinic_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Incohérence multi-tenant : % consultation(s) pointent vers un patient d''une autre clinic', v_count;
  END IF;

  -- actes_consultations → consultations
  SELECT COUNT(*) INTO v_count
  FROM actes_consultations a
  JOIN consultations c ON c.id = a.consultation_id
  WHERE c.clinic_id IS DISTINCT FROM a.clinic_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Incohérence multi-tenant : % acte(s) pointent vers une consultation d''une autre clinic', v_count;
  END IF;

  -- factures → consultations (consultation_id peut être NULL = factures libres)
  SELECT COUNT(*) INTO v_count
  FROM factures f
  JOIN consultations c ON c.id = f.consultation_id
  WHERE f.consultation_id IS NOT NULL
    AND c.clinic_id IS DISTINCT FROM f.clinic_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Incohérence multi-tenant : % facture(s) pointent vers une consultation d''une autre clinic', v_count;
  END IF;

  -- ordonnances → consultations
  SELECT COUNT(*) INTO v_count
  FROM ordonnances o
  JOIN consultations c ON c.id = o.consultation_id
  WHERE c.clinic_id IS DISTINCT FROM o.clinic_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Incohérence multi-tenant : % ordonnance(s) pointent vers une consultation d''une autre clinic', v_count;
  END IF;

  RAISE NOTICE 'Gate OK : aucune incohérence multi-tenant détectée.';
END $$;

-- -----------------------------------------------------------------------------
-- 1) UNIQUE (clinic_id, id) sur chaque table racine.
--    Nécessaire pour pouvoir pointer une FK composite dessus.
-- -----------------------------------------------------------------------------
ALTER TABLE owners          ADD CONSTRAINT owners_clinic_id_id_key          UNIQUE (clinic_id, id);
ALTER TABLE patients        ADD CONSTRAINT patients_clinic_id_id_key        UNIQUE (clinic_id, id);
ALTER TABLE consultations   ADD CONSTRAINT consultations_clinic_id_id_key   UNIQUE (clinic_id, id);

-- -----------------------------------------------------------------------------
-- 2) Drop FK simples + recrée FK composites.
--    On drop AVANT d'ajouter pour éviter la coexistence FK simple + composite.
-- -----------------------------------------------------------------------------

-- patients.owner_id → owners(id)  →  (clinic_id, owner_id) → owners(clinic_id, id)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_owner_id_fkey;
ALTER TABLE patients
  ADD CONSTRAINT patients_clinic_owner_fkey
  FOREIGN KEY (clinic_id, owner_id)
  REFERENCES owners (clinic_id, id)
  ON DELETE RESTRICT;

-- consultations.patient_id → patients(id)
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_patient_id_fkey;
ALTER TABLE consultations
  ADD CONSTRAINT consultations_clinic_patient_fkey
  FOREIGN KEY (clinic_id, patient_id)
  REFERENCES patients (clinic_id, id)
  ON DELETE RESTRICT;

-- actes_consultations.consultation_id → consultations(id)
ALTER TABLE actes_consultations DROP CONSTRAINT IF EXISTS actes_consultations_consultation_id_fkey;
ALTER TABLE actes_consultations
  ADD CONSTRAINT actes_consultations_clinic_consultation_fkey
  FOREIGN KEY (clinic_id, consultation_id)
  REFERENCES consultations (clinic_id, id)
  ON DELETE CASCADE;

-- factures.consultation_id → consultations(id)   (nullable)
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_consultation_id_fkey;
ALTER TABLE factures
  ADD CONSTRAINT factures_clinic_consultation_fkey
  FOREIGN KEY (clinic_id, consultation_id)
  REFERENCES consultations (clinic_id, id)
  ON DELETE SET NULL;

-- ordonnances.consultation_id → consultations(id)
ALTER TABLE ordonnances DROP CONSTRAINT IF EXISTS ordonnances_consultation_id_fkey;
ALTER TABLE ordonnances
  ADD CONSTRAINT ordonnances_clinic_consultation_fkey
  FOREIGN KEY (clinic_id, consultation_id)
  REFERENCES consultations (clinic_id, id)
  ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 3) Index de support pour les nouvelles FK (Postgres ne les crée PAS tout seul
--    pour le côté "enfant"). Améliore les JOIN et les DELETE CASCADE.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS patients_clinic_owner_idx              ON patients (clinic_id, owner_id);
CREATE INDEX IF NOT EXISTS consultations_clinic_patient_idx       ON consultations (clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS actes_clinic_consultation_idx          ON actes_consultations (clinic_id, consultation_id);
CREATE INDEX IF NOT EXISTS factures_clinic_consultation_idx       ON factures (clinic_id, consultation_id);
CREATE INDEX IF NOT EXISTS ordonnances_clinic_consultation_idx    ON ordonnances (clinic_id, consultation_id);

COMMIT;

-- =============================================================================
-- Post-migration — TODO côté code (à faire AVANT d'expédier cette migration)
-- =============================================================================
--
-- 1. Drizzle schema — mettre à jour les .references() :
--    Avant :
--       ownerId: integer("owner_id").references(() => ownersTable.id),
--    Après : ne plus déclarer de .references() (Drizzle ne supporte pas les FK
--       composites nativement côté types) — la contrainte vit dans la base,
--       c'est suffisant. OU utiliser `foreignKey({ columns, foreignColumns })`
--       dans le 3e arg du `pgTable` pour une FK composite.
--
-- 2. Zéro requête applicative à changer : toutes les requêtes filtrent déjà
--    sur clinic_id depuis les patches P0-5/P0-6. Cette migration est
--    purement défensive.
-- =============================================================================
