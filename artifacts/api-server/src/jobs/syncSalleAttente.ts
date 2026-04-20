import { db } from "@workspace/db";
import { rendezVousTable } from "@workspace/db";
import { and, lt, inArray, gte, lte, sql, not, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const JOB_NAME = "sync-salle-attente";

/**
 * Synchronisation salle d'attente ↔ agenda (toutes les 5 minutes)
 *
 * Ce job fait deux choses :
 * 1. Clôture les RDVs des jours passés toujours en "en_attente_arrivee" ou "arrive"
 *    (patient ne s'est jamais présenté ou RDV non clôturé)
 * 2. Remonte une statistique des RDVs actifs du jour pour monitoring
 */
export async function syncSalleAttente(): Promise<void> {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const startOfToday = `${today}T00:00:00`;

    // 1. Clôturer les RDVs des jours PRÉCÉDENTS restés en attente
    const stale = await db
      .update(rendezVousTable)
      .set({ statutSalle: "termine" })
      .where(
        and(
          lt(rendezVousTable.dateHeure, startOfToday),
          inArray(rendezVousTable.statutSalle, ["en_attente_arrivee", "arrive"])
        )
      )
      .returning({ id: rendezVousTable.id });

    if (stale.length > 0) {
      logger.info({ job: JOB_NAME, clotures: stale.length }, "RDVs passés non clôturés → marqués terminés");
    }

    // 2. Compter les RDVs actifs d'aujourd'hui pour monitoring
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rendezVousTable)
      .where(
        and(
          gte(rendezVousTable.dateHeure, startOfToday),
          lte(rendezVousTable.dateHeure, `${today}T23:59:59`),
          not(eq(rendezVousTable.statutSalle, "termine"))
        )
      );

    logger.debug(
      { job: JOB_NAME, rdvsActifsAujourdhui: Number(count), clotures: stale.length },
      "Sync salle d'attente terminée"
    );
  } catch (err) {
    logger.warn({ job: JOB_NAME, err }, "Sync salle d'attente — erreur non bloquante");
  }
}

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startSyncJob(): void {
  // Première exécution immédiate au démarrage
  syncSalleAttente();
  // Puis toutes les 5 minutes
  setInterval(syncSalleAttente, INTERVAL_MS);
  logger.info({ job: JOB_NAME, intervalMs: INTERVAL_MS }, "Job de sync salle d'attente démarré");
}
