import "./instrument";
import app from "./app";
import { logger } from "./lib/logger";
import { runStockSeeder } from "./routes/stock/seeder";
import { startSyncJob } from "./jobs/syncSalleAttente";
import { startRappelsJob } from "./jobs/sendRappels";
import { startStockAnalysisJob } from "./jobs/stockAnalysis";
import { setupVetKnowledge } from "./lib/vetKnowledgeService";
import { db } from "@workspace/db";
import { runMigrations } from "./lib/runMigrations";

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

  // Migrations DB -- idempotentes, extraites vers lib/runMigrations.ts (audit Phase 0)
  await runMigrations(db, logger);

  // Auto-seed stock demo si vide
  runStockSeeder("default")
    .then(result => {
      if (result.inserted > 0) {
        logger.info(result, "Stock initialise avec les donnees demo");
      }
    })
    .catch(err => {
      logger.warn({ err }, "Auto-seeding stock ignore (non bloquant)");
    });

  // Jobs recurrents
  startSyncJob();        // Sync salle d'attente -- agenda toutes les 5 min
  startRappelsJob();     // Envoi rappels -- toutes les heures
  startStockAnalysisJob(); // Analyse stock -- EOQ + alertes toutes les 24h

  // Base de connaissances veterinaires RAG -- non bloquante
  setupVetKnowledge().catch(err => {
    logger.warn({ err }, "setupVetKnowledge ignore (non bloquant)");
  });
});
