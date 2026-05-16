-- Migration 013 — Factur-X Generation + Budget View
-- VetoAI — Sprint 2/3 (2026-05-16)
-- Colonnes reelles ai_usage_logs : cost_usd, model, duration_ms, task_type
-- Compatible avec le schema Drizzle existant (lib/db/src/schema/ai-usage-logs.ts)
-- ============================================================

BEGIN;

-- 1. Colonnes Factur-X sur factures
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS facturx_xml          TEXT,
  ADD COLUMN IF NOT EXISTS facturx_pdf_url      TEXT,
  ADD COLUMN IF NOT EXISTS facturx_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facturx_version      VARCHAR(20) DEFAULT 'EN16931-BASIC';

-- 2. Contrainte CHECK facturx_version
ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS chk_factures_facturx_version;
ALTER TABLE factures
  ADD CONSTRAINT chk_factures_facturx_version
  CHECK (facturx_version IN ('EN16931-BASIC', 'EN16931-MINIMUM', 'EN16931-EXTENDED'));

-- 3. BUG-04 : adresse decomposee sur owners (BT-52 / BT-53 EN16931)
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS ville       TEXT;

-- 4. Vue budget IA 30 jours
-- Utilise les vrais noms de colonnes : cost_usd, model, duration_ms
-- alerte_budget = TRUE si cout moyen > $0.15/consult
CREATE OR REPLACE VIEW v_ai_budget_clinic_30d AS
SELECT
  clinic_id,
  COUNT(*)                                          AS nb_appels,
  COUNT(DISTINCT consultation_id)                   AS consults_avec_ia,
  SUM(cost_usd)                                     AS cout_total_usd,
  SUM(cost_usd) / NULLIF(COUNT(DISTINCT consultation_id), 0)
                                                    AS cout_moyen_par_consult_usd,
  AVG(duration_ms)                                  AS latence_moyenne_ms,
  COUNT(*) FILTER (WHERE model ILIKE '%sonnet%' OR model ILIKE '%claude%')
                                                    AS nb_appels_sonnet,
  COUNT(*) FILTER (WHERE model ILIKE '%mini%' OR model ILIKE '%gpt-4o-mini%')
                                                    AS nb_appels_mini,
  CASE
    WHEN COUNT(DISTINCT consultation_id) = 0 THEN FALSE
    WHEN SUM(cost_usd) / NULLIF(COUNT(DISTINCT consultation_id), 0) > 0.15 THEN TRUE
    ELSE FALSE
  END                                               AS alerte_budget
FROM ai_usage_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY clinic_id;

COMMENT ON VIEW v_ai_budget_clinic_30d IS
  'Budget IA par clinique sur 30 jours — alerte_budget=TRUE si cout_moyen_par_consult_usd > 0.15';

-- Index pour performance Factur-X
CREATE INDEX IF NOT EXISTS idx_factures_facturx_status
  ON factures(facturx_generated_at)
  WHERE facturx_generated_at IS NOT NULL;

COMMIT;
