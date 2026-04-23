-- P1-1 : s'assurer que actes_consultations.tva_rate existe et a un défaut à 20.
--
-- À vérifier d'abord dans le schéma Drizzle existant. Si la colonne est déjà là
-- avec un default 20, cette migration est idempotente (IF NOT EXISTS).

BEGIN;

ALTER TABLE actes_consultations
  ADD COLUMN IF NOT EXISTS tva_rate numeric NOT NULL DEFAULT 20;

COMMIT;
