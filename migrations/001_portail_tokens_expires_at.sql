-- P0-1 / P1-6 : ajout de expires_at sur portail_tokens + index.
--
-- Safe pour une base existante : on crée la colonne NULLABLE, on backfill
-- avec now() + 90 days pour les tokens existants, puis on passe NOT NULL.
--
-- À exécuter dans une fenêtre de maintenance (verrou court sur la table).

BEGIN;

ALTER TABLE portail_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE portail_tokens
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '90 days')
WHERE expires_at IS NULL;

ALTER TABLE portail_tokens
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portail_tokens_expires_at
  ON portail_tokens (expires_at);

COMMIT;
