-- Migration 011: Migrate AI output fields to JSONB for queryability
-- P2-1 : Champs IA en JSONB + index GIN
-- Date: 2026-05-11
-- Fix: supprime CREATE INDEX (incompatible Railway/transactions)

-- ============================================================
-- consultations: diagnostic_ia TEXT → JSONB
-- ============================================================
DO $$
BEGIN
-- Add new JSONB column if it doesn't exist
IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'consultations' AND column_name = 'diagnostic_ia_json'
  ) THEN
ALTER TABLE consultations ADD COLUMN diagnostic_ia_json JSONB;
END IF;
END $$;

-- Migrate existing TEXT data to JSONB (best-effort: wrap as {"raw": ...} if not valid JSON)
UPDATE consultations
SET diagnostic_ia_json = CASE
WHEN diagnostic_ia IS NULL THEN NULL
WHEN diagnostic_ia ~ '^\s*\{' THEN diagnostic_ia::jsonb
ELSE jsonb_build_object('raw', diagnostic_ia)
END
WHERE diagnostic_ia_json IS NULL AND diagnostic_ia IS NOT NULL;

-- GIN index for JSONB search (sans — compatible Railway)
CREATE INDEX IF NOT EXISTS idx_consultations_diagnostic_ia_json
ON consultations USING GIN (diagnostic_ia_json);

-- ============================================================
-- consultations: actes_ia TEXT → JSONB
-- ============================================================
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'consultations' AND column_name = 'actes_ia_json'
  ) THEN
ALTER TABLE consultations ADD COLUMN actes_ia_json JSONB;
END IF;
END $$;

UPDATE consultations
SET actes_ia_json = CASE
WHEN actes_ia IS NULL THEN NULL
WHEN actes_ia ~ '^\s*\[' THEN actes_ia::jsonb
WHEN actes_ia ~ '^\s*\{' THEN actes_ia::jsonb
ELSE jsonb_build_array(jsonb_build_object('raw', actes_ia))
END
WHERE actes_ia_json IS NULL AND actes_ia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_actes_ia_json
ON consultations USING GIN (actes_ia_json);

-- ============================================================
-- ai_outputs table: ensure output_data is JSONB (not TEXT)
-- ============================================================
DO $$
BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'ai_outputs' AND column_name = 'output_data'
  AND data_type = 'text'
  ) THEN
ALTER TABLE ai_outputs
ALTER COLUMN output_data TYPE JSONB USING
CASE
WHEN output_data ~ '^\s*[\[{]' THEN output_data::jsonb
ELSE jsonb_build_object('raw', output_data)
END;
END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_outputs_output_data
ON ai_outputs USING GIN (output_data)
WHERE output_data IS NOT NULL;

-- ============================================================
-- ai_outputs: index sur model + created_at pour analytics
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_outputs_model_created
ON ai_outputs (model, created_at DESC)
WHERE model IS NOT NULL;

-- ============================================================
-- Keep TEXT columns for backward compat (nullable)
-- New code writes to JSON columns; legacy reads TEXT fallback
-- Remove TEXT columns in migration 013 after full cutover
-- ============================================================

COMMENT ON COLUMN consultations.diagnostic_ia_json IS 'JSONB version of diagnostic_ia — use this for new queries';
COMMENT ON COLUMN consultations.actes_ia_json IS 'JSONB version of actes_ia — use this for new queries';
