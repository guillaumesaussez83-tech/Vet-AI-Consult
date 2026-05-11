-- Migration 009: convertir date_naissance TEXT -> DATE sur patients
-- Étape 1 : ajouter colonne temporaire de type DATE
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_naissance_new DATE;

-- Étape 2 : copier les valeurs en castant (formats ISO 8601 YYYY-MM-DD)
UPDATE patients
SET date_naissance_new = date_naissance::DATE
WHERE date_naissance IS NOT NULL
  AND date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- Étape 3 : supprimer l'ancienne colonne TEXT
ALTER TABLE patients DROP COLUMN IF EXISTS date_naissance;

-- Étape 4 : renommer la nouvelle colonne
ALTER TABLE patients RENAME COLUMN date_naissance_new TO date_naissance;

-- Index pour recherches par date de naissance
CREATE INDEX IF NOT EXISTS patients_date_naissance_idx ON patients(date_naissance);
