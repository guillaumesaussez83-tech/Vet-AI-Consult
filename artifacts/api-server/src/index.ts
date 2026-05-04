import "./instrument";
import app from "./app";
import { logger } from "./lib/logger";
import { runStockSeeder } from "./routes/stock/seeder";
import { startSyncJob } from "./jobs/syncSalleAttente";
import { startRappelsJob } from "./jobs/sendRappels";
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

  // Auto-seed stock demo data if stock is empty
  runStockSeeder("default")
    .then(result => {
      if (result.inserted > 0) {
        logger.info(result, "Stock initialisé automatiquement avec les données démo");
      }
    })
    .catch(err => {
      logger.warn({ err }, "Auto-seeding du stock ignoré (erreur non bloquante)");
    });

  // Sync salle d'attente ↔ agenda toutes les 5 min
  startSyncJob();

  // Initialisation base de connaissances vétérinaires RAG (ANMV/EMA/RESAPATH)
  // Non bloquante — dégradation gracieuse si OPENAI_API_KEY absent
  setupVetKnowledge().catch(err => {
    logger.warn({ err }, "setupVetKnowledge ignoré (erreur non bloquante)");
  });
});
