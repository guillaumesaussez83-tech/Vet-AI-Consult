import "./instrument";
import app from "./app";
import { logger } from "./lib/logger";
import { runStockSeeder } from "./routes/stock/seeder";
import { startSyncJob } from "./jobs/syncSalleAttente";
import { startRappelsJob } from "./jobs/sendRappels";
import { startStockAnalysisJob } from "./jobs/stockAnalysis";
import { setupVetKnowledge } from "./lib/vetKnowledgeService";
import { db } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // Auto-migration consultation workflow (idempotent)
  try {
    await (db as any).execute(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS phase VARCHAR(50) DEFAULT 'anamnese';
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS anamnese_ia TEXT;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS examen_ia TEXT;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS examens_complementaires_valides JSONB;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS synthese_ia TEXT;
    `);
    logger.info("Workflow migration: OK");
  } catch (e) {
    logger.warn({ err: e }, "Workflow migration skipped");
  }

  // Auto-migration Sprint 1 Ã¢ÂÂ No-Show RDV + AMM Ordonnances (idempotent)
  try {
    await (db as any).execute(`
      ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
      ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
      ALTER TABLE ordonnances ADD COLUMN IF NOT EXISTS numero_amm TEXT;
    `);
    logger.info("Sprint 1 DB migration OK");
  } catch (e) {
    logger.warn({ err: e }, "Sprint 1 migration skipped");
  }

  // Sprint 4B migration â user_permissions table
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        module VARCHAR(50) NOT NULL,
        can_read BOOLEAN NOT NULL DEFAULT true,
        can_write BOOLEAN NOT NULL DEFAULT false,
        can_delete BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_perms_user_module ON user_permissions(user_id, module);
    `);
    logger.info("Sprint 4B DB migration OK");
  } catch (e) {
    logger.warn({ err: e }, "Sprint 4B migration skipped");
  }

  // Sprint 4C migration — consultation_patients + consultation_attachments
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS consultation_patients (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(consultation_id, patient_id)
      );
      CREATE TABLE IF NOT EXISTS consultation_attachments (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        data_base64 TEXT NOT NULL,
        uploaded_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Sprint 4C DB migration OK");
  } catch (e) {
    logger.warn({ err: e }, "Sprint 4C migration skipped");
  }

  // Auto-seed stock demo data if stock is empty
  runStockSeeder("default")
    .then(result => {
      if (result.inserted > 0) {
        logger.info(result, "Stock initialisÃÂÃÂ© automatiquement avec les donnÃÂÃÂ©es dÃÂÃÂ©mo");
      }
    })
    .catch(err => {
      logger.warn({ err }, "Auto-seeding du stock ignorÃÂÃÂ© (erreur non bloquante)");
    });

  // Sync salle d'attente ÃÂ¢ÃÂÃÂ agenda toutes les 5 min
  startSyncJob();

  // Envoi automatique des rappels (toutes les heures)
  startRappelsJob();

  // Analyse nocturne du stock ÃÂ¢ÃÂÃÂ EOQ + alertes (toutes les 24h, dÃÂÃÂ©marrage dans 5 min)
  startStockAnalysisJob();

  // Initialisation base de connaissances vÃÂÃÂ©tÃÂÃÂ©rinaires RAG (ANMV/EMA/RESAPATH)
  // Non bloquante ÃÂ¢ÃÂÃÂ dÃÂÃÂ©gradation gracieuse si OPENAI_API_KEY absent
  setupVetKnowledge().catch(err => {
    logger.warn({ err }, "setupVetKnowledge ignorÃÂÃÂ© (erreur non bloquante)");
  });
});
