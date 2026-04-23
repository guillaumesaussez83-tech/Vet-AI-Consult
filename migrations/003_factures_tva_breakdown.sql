-- P1-1 : ajout de tva_breakdown sur factures pour traçabilité multi-taux.
--
-- Colonne JSONB optionnelle. Format :
--   [{"rate": 20, "ht": 123.45, "tva": 24.69}, {"rate": 10, "ht": 50.00, "tva": 5.00}]
--
-- La colonne tva existante (taux moyen pondéré) reste pour compat front.

BEGIN;

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb;

COMMIT;

-- Mémo : mettre à jour le schéma Drizzle `lib/db/src/schema/factures.ts`
-- en ajoutant `tvaBreakdown: jsonb("tva_breakdown")` pour que l'ORM
-- reconnaisse le champ.
