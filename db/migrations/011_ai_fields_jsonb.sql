-- Migration 011: Add JSONB columns for AI outputs to consultations table
-- Railway-compatible: no CREATE INDEX CONCURRENTLY (runs in auto-transaction)
-- hotfix/audit-verification-p0

-- Step 1: Add JSONB columns (nullable, backward-compatible)
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS diagnostic_ia_json JSONB,
  ADD COLUMN IF NOT EXISTS actes_ia_json      JSONB;

-- Step 2: Backfill from existing TEXT columns where data is valid JSON
-- diagnostic_ia_json: attempt to parse diagnostic_ia text as JSON
UPDATE consultations
SET diagnostic_ia_json = diagnostic_ia::jsonb
WHERE diagnostic_ia IS NOT NULL
  AND diagnostic_ia <> ''
  AND diagnostic_ia::text ~ '^\s*[\[\{]';

-- actes_ia_json: attempt to parse actes_ia text as JSON
UPDATE consultations
SET actes_ia_json = actes_ia::jsonb
WHERE actes_ia IS NOT NULL
  AND actes_ia <> ''
  AND actes_ia::text ~ '^\s*[\[\{]';

-- Step 3: GIN indexes for JSONB search performance
-- NOTE: No CONCURRENTLY — Railway wraps migrations in a transaction
CREATE INDEX IF NOT EXISTS idx_consultations_diagnostic_ia_json
  ON consultations USING GIN (diagnostic_ia_json);

CREATE INDEX IF NOT EXISTS idx_consultations_actes_ia_json
  ON consultations USING GIN (actes_ia_json);

-- Keep TEXT columns for backward compat (remove in migration 013 after full cutover)
