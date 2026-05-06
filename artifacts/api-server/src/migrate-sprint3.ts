import pg from "pg";
const { Client } = pg;

const SQL = `
CREATE TABLE IF NOT EXISTS medications_anmv (
  id SERIAL PRIMARY KEY,
  amm TEXT NOT NULL,
  nom_commercial TEXT NOT NULL,
  molecule TEXT NOT NULL,
  forme TEXT NOT NULL,
  dosage TEXT,
  voie TEXT,
  especes_autorisees TEXT[] NOT NULL DEFAULT '{}',
  indication TEXT,
  posologie TEXT,
  contre_indication TEXT,
  delai_attente TEXT,
  statut TEXT NOT NULL DEFAULT 'actif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_anmv_indication_fts ON medications_anmv
  USING GIN (to_tsvector('french', COALESCE(indication, '')));

CREATE INDEX IF NOT EXISTS idx_medications_anmv_especes ON medications_anmv
  USING GIN (especes_autorisees);

CREATE INDEX IF NOT EXISTS idx_medications_anmv_molecule ON medications_anmv (molecule);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id SERIAL PRIMARY KEY,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  output_json JSONB,
  was_validated BOOLEAN NOT NULL DEFAULT FALSE,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_consultation_id ON ai_outputs (consultation_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_phase ON ai_outputs (consultation_id, phase);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_validated ON ai_outputs (was_validated, validated_at);
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to Railway DB");
  try {
    await client.query(SQL);
    console.log("Sprint 3 migration completed successfully");
  } finally {
    await client.end();
    console.log("Connection closed");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
