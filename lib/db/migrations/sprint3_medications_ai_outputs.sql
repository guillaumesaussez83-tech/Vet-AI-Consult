-- ============================================================
-- Sprint 3 — VétoAI : Migration SQL Railway
-- Tables: medications_anmv, ai_outputs
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: medications_anmv
-- Médicaments vétérinaires ANMV (chiens & chats)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications_anmv (
  id              SERIAL PRIMARY KEY,
  amm             TEXT NOT NULL,                        -- N° AMM ex: FR/V/0123456789
  nom_commercial  TEXT NOT NULL,
  molécule        TEXT NOT NULL,
  forme           TEXT NOT NULL,                        -- comprimé, solution injectable...
  dosage          TEXT,                                 -- ex: 50 mg/ml
  voie            TEXT,                                 -- orale, injectable, topique...
  especes_autorisees TEXT[] NOT NULL DEFAULT '{}',      -- ['CA','FE','EQ'...]
  indication      TEXT,                                 -- texte libre pour full-text search
  posologie       TEXT,
  contre_indication TEXT,
  delai_attente   TEXT,
  statut          TEXT NOT NULL DEFAULT 'actif',        -- actif | retiré
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index full-text sur indication (French dictionary)
CREATE INDEX IF NOT EXISTS idx_medications_anmv_indication_fts
  ON medications_anmv
  USING GIN (to_tsvector('french', COALESCE(indication, '')));

-- Index sur espèces pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_medications_anmv_especes
  ON medications_anmv
  USING GIN (especes_autorisees);

-- Index sur molécule
CREATE INDEX IF NOT EXISTS idx_medications_anmv_molecule
  ON medications_anmv (molécule);

-- ────────────────────────────────────────────────────────────
-- TABLE: ai_outputs
-- Historique de tous les appels IA du pipeline consultation
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_outputs (
  id              SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL
    REFERENCES consultations(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL,                        -- anamnese | examen_clinique | synthese
  model           TEXT NOT NULL,                        -- gpt-4o-mini | claude-sonnet-4-5
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  latency_ms      INTEGER,
  output_json     JSONB,                                -- structured IA output
  was_validated   BOOLEAN NOT NULL DEFAULT FALSE,       -- true après /terminer
  validated_by    TEXT,                                 -- Clerk user ID du vétérinaire
  validated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur consultation_id pour récupération rapide
CREATE INDEX IF NOT EXISTS idx_ai_outputs_consultation_id
  ON ai_outputs (consultation_id);

-- Index sur phase pour filtrage
CREATE INDEX IF NOT EXISTS idx_ai_outputs_phase
  ON ai_outputs (consultation_id, phase);

-- Index sur validated pour stats
CREATE INDEX IF NOT EXISTS idx_ai_outputs_validated
  ON ai_outputs (was_validated, validated_at);

-- ────────────────────────────────────────────────────────────
-- Trigger updated_at sur medications_anmv
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_medications_anmv_updated_at ON medications_anmv;
CREATE TRIGGER set_medications_anmv_updated_at
  BEFORE UPDATE ON medications_anmv
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

