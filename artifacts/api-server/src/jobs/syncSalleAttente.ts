import { db } from "@workspace/db";
import { rendezVousTable } from "@workspace/db";
import { and, lt, inArray, gte, lte, sql, not, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const JOB_NAME = "sync-salle-attente";

/**
 * Synchronisation salle d'attente ↔ agenda (toutes les 5 minutes)
 *
 * P1-4 : l'ancienne version faisait un UPDATE global sans distinction de
 * clinique. Fonctionnel mais rendait chaque erreur contaminante pour toutes
 * les cliniques. La nouvelle version :
 *   1. Découvre les cliniques actives (DISTINCT clinicId) des RDV concernés.
 *   2. Boucle clinique-par-clinique avec try/catch isolé.
 *   3. Logue par clinique pour debug + monitoring.
 *
 * Aucune donnée n'est partagée entre itérations → une clinique en panne DB
 * n'empêche pas les autres d'être synchronisées.
 */
export async function syncSalleAttente(): Promise<void> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const startOfToday = `${today}T00:00:00`;
  const endOfToday = `${today}T23:59:59`;

  // 1. Liste des cliniques ayant des RDV passés en attente.
  let cliniques: Array<{ clinicId: string }>;
  try {
    cliniques = await db
      .selectDistinct({ clinicId: rendezVousTable.clinicId })
      .from(rendezVousTable)
      .where(
        and(
          lt(rendezVousTable.dateHeure, startOfToday),
          inArray(rendezVousTable.statutSalle, ["en_attente_arrivee", "arrive"]),
        ),
      );
  } catch (err) {
    logger.warn({ job: JOB_NAME, err }, "Impossible de lister les cliniques actives — job skippé");
    return;
  }

  if (cliniques.length === 0) {
    logger.debug({ job: JOB_NAME }, "Aucune clinique à synchroniser");
    return;
  }

  let totalClotures = 0;
  let totalRdvActifs = 0;
  const errors: Array<{ clinicId: string; err: unknown }> = [];

  for (const { clinicId } of cliniques) {
    try {
      // Clôture des RDVs passés de cette clinique uniquement.
      const stale = await db
        .update(rendezVousTable)
        .set({ statutSalle: "termine" })
        .where(
          and(
            eq(rendezVousTable.clinicId, clinicId),
            lt(rendezVousTable.dateHeure, startOfToday),
            inArray(rendezVousTable.statutSalle, ["en_attente_arrivee", "arrive"]),
          ),
        )
        .returning({ id: rendezVousTable.id });

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(rendezVousTable)
        .where(
          and(
            eq(rendezVousTable.clinicId, clinicId),
            gte(rendezVousTable.dateHeure, startOfToday),
            lte(rendezVousTable.dateHeure, endOfToday),
            not(eq(rendezVousTable.statutSalle, "termine")),
          ),
        );

      totalClotures += stale.length;
      totalRdvActifs += Number(count);

      if (stale.length > 0) {
        logger.info(
          { job: JOB_NAME, clinicId, clotures: stale.length, rdvsActifs: Number(count) },
          "Sync clinique OK",
        );
      }
    } catch (err) {
      // Une clinique en erreur ne plante pas les autres.
      errors.push({ clinicId, err });
      logger.warn({ job: JOB_NAME, clinicId, err }, "Sync clinique échouée (isolée)");
    }
  }

  logger.debug(
    {
      job: JOB_NAME,
      cliniques: cliniques.length,
      totalClotures,
      totalRdvActifs,
      errors: errors.length,
    },
    "Sync salle d'attente terminée",
  );

  if (errors.length > 0) {
    logger.warn(
      { job: JOB_NAME, failedClinics: errors.map((e) => e.clinicId) },
      `Sync partielle : ${errors.length} clinique(s) en erreur`,
    );
  }
}

const INTERVAL_MS = 5 * 60 * 1000;

export function startSyncJob(): void {
  // Première exécution immédiate au démarrage
  void syncSalleAttente();
  // Puis toutes les 5 minutes
  setInterval(syncSalleAttente, INTERVAL_MS);
  logger.info({ job: JOB_NAME, intervalMs: INTERVAL_MS }, "Job de sync salle d'attente démarré");
}
