#!/usr/bin/env bash
# =============================================================================
# test_migration_011.sh — Vérifie que la migration 011 s'applique proprement
# Usage: DATABASE_URL="postgresql://user:pass@host:5432/db" bash test_migration_011.sh
# =============================================================================
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL requis}"

echo "=== [1/4] Application de la migration 011 ================================="
psql "$DB" <<'SQL'
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS diagnostic_ia_json JSONB,
  ADD COLUMN IF NOT EXISTS actes_ia_json      JSONB;

UPDATE consultations
SET diagnostic_ia_json = diagnostic_ia::jsonb
WHERE diagnostic_ia IS NOT NULL
  AND diagnostic_ia <> ''
  AND diagnostic_ia::text ~ '^\s*[\[\{]';

UPDATE consultations
SET actes_ia_json = actes_ia::jsonb
WHERE actes_ia IS NOT NULL
  AND actes_ia <> ''
  AND actes_ia::text ~ '^\s*[\[\{]';

CREATE INDEX IF NOT EXISTS idx_consultations_diagnostic_ia_json
  ON consultations USING GIN (diagnostic_ia_json);

CREATE INDEX IF NOT EXISTS idx_consultations_actes_ia_json
  ON consultations USING GIN (actes_ia_json);
SQL

echo ""
echo "=== [2/4] Colonnes JSONB =================================================="
psql "$DB" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'consultations'
  AND column_name IN ('diagnostic_ia_json','actes_ia_json')
ORDER BY column_name;"

echo ""
echo "=== [3/4] Index GIN ======================================================="
psql "$DB" -c "
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='consultations'
  AND indexname IN ('idx_consultations_diagnostic_ia_json','idx_consultations_actes_ia_json');"

echo ""
echo "=== [4/4] Backfill stats =================================================="
psql "$DB" -c "
SELECT
  COUNT(*) FILTER (WHERE diagnostic_ia IS NOT NULL AND diagnostic_ia <> '') AS text_diag,
  COUNT(*) FILTER (WHERE diagnostic_ia_json IS NOT NULL)                    AS json_diag,
  COUNT(*) FILTER (WHERE actes_ia IS NOT NULL AND actes_ia <> '')           AS text_actes,
  COUNT(*) FILTER (WHERE actes_ia_json IS NOT NULL)                         AS json_actes
FROM consultations;"

echo ""
echo "✅  Migration 011 OK — aucune donnée TEXT perdue si text >= json"
