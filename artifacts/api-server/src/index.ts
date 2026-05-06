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

  // Auto-migration Sprint 1 — No-Show RDV + AMM Ordonnances (idempotent)
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

  // Auto-seed stock demo data if stock is empty
  runStockSeeder("default")
    .then(result => {
      if (result.inserted > 0) {
        logger.info(result, "Stock initialisÃ© automatiquement avec les donnÃ©es dÃ©mo");
      }
    })
    .catch(err => {
      logger.warn({ err }, "Auto-seeding du stock ignorÃ© (erreur non bloquante)");
    });

  // Sync salle d'attente â agenda toutes les 5 min
  startSyncJob();

  // Envoi automatique des rappels (toutes les heures)
  startRappelsJob();

  // Analyse nocturne du stock â EOQ + alertes (toutes les 24h, dÃ©marrage dans 5 min)
  startStockAnalysisJob();

  // Initialisation base de connaissances vÃ©tÃ©rinaires RAG (ANMV/EMA/RESAPATH)
  // Non bloquante â dÃ©gradation gracieuse si OPENAI_API_KEY absent
  setupVetKnowledge().catch(err => {
    logger.warn({ err }, "setupVetKnowledge ignorÃ© (erreur non bloquante)");
  });
});
