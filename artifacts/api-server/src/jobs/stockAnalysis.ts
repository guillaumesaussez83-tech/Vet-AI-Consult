import { db } from "@workspace/db";
import { stockMedicamentsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { analyserConsommationTous, genererAlertes } from "../routes/stock/ia-engine";

const JOB_NAME = "stock-analysis-nightly";
/** Toutes les 24 heures */
const INTERVAL_MS = 24 * 60 * 60 * 1_000;
/** Délai initial au démarrage (5 min) — laisse la DB s'initialiser */
const STARTUP_DELAY_MS = 5 * 60 * 1_000;

/**
 * Analyse nocturne du stock pour toutes les cliniques actives.
 *
 * Pour chaque clinique :
 *  1. analyserConsommationTous — recalcule ADC, EOQ, point de commande
 *  2. genererAlertes — crée les alertes rupture/stock bas/péremption/surstockage
 *
 * Non-bloquant : les erreurs par clinique sont isolées (ne stoppent pas les autres).
 */
export async function runStockAnalysis(): Promise<void> {
  let clinicIds: string[];
  try {
    const rows = await db
      .selectDistinct({ clinicId: stockMedicamentsTable.clinicId })
      .from(stockMedicamentsTable);
    clinicIds = rows.map((r) => r.clinicId);
  } catch (err) {
    logger.warn({ job: JOB_NAME, err }, "Impossible de lister les cliniques — job skippé");
    return;
  }

  if (clinicIds.length === 0) {
    logger.debug({ job: JOB_NAME }, "Aucune clinique avec du stock");
    return;
  }

  logger.info({ job: JOB_NAME, clinicCount: clinicIds.length }, "Analyse stock nocturne démarrée");

  let totalUpdated = 0;
  let totalAlertes = 0;
  let errors = 0;

  for (const clinicId of clinicIds) {
    try {
      const { updated } = await analyserConsommationTous(clinicId);
      totalUpdated += updated;
      logger.debug({ job: JOB_NAME, clinicId, updated }, "Consommation analysée");
    } catch (err) {
      errors++;
      logger.warn({ job: JOB_NAME, clinicId, err }, "Erreur analyse consommation — clinique ignorée");
    }

    try {
      const alertes = await genererAlertes(clinicId);
      totalAlertes += alertes;
      logger.debug({ job: JOB_NAME, clinicId, alertes }, "Alertes stock générées");
    } catch (err) {
      errors++;
      logger.warn({ job: JOB_NAME, clinicId, err }, "Erreur génération alertes — clinique ignorée");
    }
  }

  logger.info(
    { job: JOB_NAME, clinicCount: clinicIds.length, totalUpdated, totalAlertes, errors },
    "Analyse stock nocturne terminée",
  );
}

export function startStockAnalysisJob(): void {
  // Premier run 5 min après démarrage
  setTimeout(() => void runStockAnalysis(), STARTUP_DELAY_MS);
  // Puis toutes les 24h
  setInterval(() => void runStockAnalysis(), INTERVAL_MS);
  logger.info(
    { job: JOB_NAME, intervalMs: INTERVAL_MS, startupDelayMs: STARTUP_DELAY_MS },
    "Job analyse stock nocturne démarré",
  );
}
