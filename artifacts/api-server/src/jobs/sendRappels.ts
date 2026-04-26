import { db } from "@workspace/db";
import { rappelsTable, patientsTable, ownersTable } from "@workspace/db";
import { and, lte, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const JOB_NAME = "send-rappels";

/**
 * Job d'envoi automatique des rappels dus (P1-6).
 *
 * Logique :
 *   1. Trouve les rappels `actif` dont dateEcheance <= aujourd'hui.
 *   2. Charge les données patient + propriétaire (email).
 *   3. Envoie un email via Resend si RESEND_API_KEY est configuré.
 *      Sans RESEND_API_KEY : log seulement (mode dégradé, pas de crash).
 *   4. Marque le rappel `envoye` dans tous les cas (évite boucle infinie).
 *
 * Multi-clinique : isolation try/catch par rappel — une erreur d'envoi
 * n'empêche pas les autres d'être traités.
 *
 * Configurable via env :
 *   RESEND_API_KEY    — clé Resend (requis pour envoi réel)
 *   EMAIL_FROM        — expéditeur (défaut: VétoAI <noreply@vetoai.fr>)
 */
export async function sendRappelsDus(): Promise<void> {
  const todayStr = new Date().toISOString().split("T")[0]!;

  let duRappels: Array<{
    id: number;
    clinicId: string;
    patientId: number | null;
    label: string;
    notes: string | null;
  }>;

  try {
    duRappels = await db
      .select({
        id: rappelsTable.id,
        clinicId: rappelsTable.clinicId,
        patientId: rappelsTable.patientId,
        label: rappelsTable.label,
        notes: rappelsTable.notes,
      })
      .from(rappelsTable)
      .where(
        and(
          eq(rappelsTable.statut, "actif"),
          lte(rappelsTable.dateEcheance, todayStr),
        ),
      );
  } catch (err) {
    logger.warn({ job: JOB_NAME, err }, "Impossible de lister les rappels dus — job skippé");
    return;
  }

  if (duRappels.length === 0) {
    logger.debug({ job: JOB_NAME }, "Aucun rappel dû aujourd'hui");
    return;
  }

  logger.info({ job: JOB_NAME, count: duRappels.length }, "Rappels dus trouvés");

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const rappel of duRappels) {
    try {
      let ownerEmail: string | null = null;
      let ownerDisplay: string | null = null;
      let patientNom: string | null = null;

      if (rappel.patientId) {
        const rows = await db
          .select({
            patientNom: patientsTable.nom,
            ownerEmail: ownersTable.email,
            ownerNom: ownersTable.nom,
            ownerPrenom: ownersTable.prenom,
          })
          .from(patientsTable)
          .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
          .where(
            and(
              eq(patientsTable.id, rappel.patientId),
              eq(patientsTable.clinicId, rappel.clinicId),
            ),
          )
          .limit(1);

        if (rows[0]) {
          ownerEmail = rows[0].ownerEmail ?? null;
          ownerDisplay = [rows[0].ownerPrenom, rows[0].ownerNom]
            .filter(Boolean)
            .join(" ") || null;
          patientNom = rows[0].patientNom ?? null;
        }
      }

      const apiKey = process.env["RESEND_API_KEY"];
      if (apiKey && ownerEmail) {
        // Import dynamique pour éviter de crasher si Resend n'est pas installé.
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey);
        const from = process.env["EMAIL_FROM"] ?? "VétoAI <noreply@vetoai.fr>";
        const subject = patientNom
          ? `Rappel pour ${patientNom} : ${rappel.label}`
          : `Rappel : ${rappel.label}`;

        await resend.emails.send({
          from,
          to: ownerEmail,
          subject,
          html: [
            `<p>Bonjour${ownerDisplay ? " " + ownerDisplay : ""},</p>`,
            `<p>Nous vous rappelons : <strong>${rappel.label}</strong>`,
            patientNom ? ` pour <strong>${patientNom}</strong>.` : ".",
            `</p>`,
            rappel.notes ? `<p>${rappel.notes}</p>` : "",
            `<p>N'hésitez pas à nous contacter pour prendre rendez-vous.</p>`,
            `<p>Cordialement,<br>L'équipe VétoAI</p>`,
          ].join(""),
        });

        logger.info(
          { job: JOB_NAME, rappelId: rappel.id, to: ownerEmail },
          "Email rappel envoyé",
        );
        sent++;
      } else if (!apiKey) {
        logger.debug(
          { job: JOB_NAME, rappelId: rappel.id },
          "RESEND_API_KEY absent — rappel loggué seulement",
        );
        skipped++;
      } else {
        logger.debug(
          { job: JOB_NAME, rappelId: rappel.id },
          "Pas d'email propriétaire — rappel marqué envoyé sans envoi",
        );
        skipped++;
      }

      // Marquer dans tous les cas pour ne pas reboucler.
      await db
        .update(rappelsTable)
        .set({ statut: "envoye" })
        .where(eq(rappelsTable.id, rappel.id));
    } catch (err) {
      failed++;
      logger.warn(
        { job: JOB_NAME, rappelId: rappel.id, err },
        "Erreur traitement rappel (isolée)",
      );
    }
  }

  logger.info({ job: JOB_NAME, sent, skipped, failed }, "Cycle rappels terminé");
}

/** Toutes les heures. */
const INTERVAL_MS = 60 * 60 * 1_000;

export function startRappelsJob(): void {
  void sendRappelsDus();
  setInterval(sendRappelsDus, INTERVAL_MS);
  logger.info({ job: JOB_NAME, intervalMs: INTERVAL_MS }, "Job envoi rappels démarré");
}
