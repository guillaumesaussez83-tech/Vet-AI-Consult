import app from "./app";
import { logger } from "./lib/logger";
import { runStockSeeder } from "./routes/stock/seeder";
import { startSyncJob } from "./jobs/syncSalleAttente";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Auto-seed stock demo data if stock is empty
  runStockSeeder()
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
});
