-- P0-8 : index unique composite (clinic_id, numero) sur factures.
--
-- Filet de sécurité en plus du pg_advisory_xact_lock : même si un bug applicatif
-- re-calcule un numéro, la DB refusera le doublon (erreur 23505).
--
-- Prérequis : aucun doublon existant. Si la requête échoue, lister les
-- collisions avec :
--   SELECT clinic_id, numero, count(*) FROM factures
--   GROUP BY clinic_id, numero HAVING count(*) > 1;
-- et renuméroter manuellement avant de ré-exécuter la migration.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_factures_clinic_numero
  ON factures (clinic_id, numero);

COMMIT;
