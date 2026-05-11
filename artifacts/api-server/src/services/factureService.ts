import { db } from "@workspace/db";
import {
  facturesTable,
  consultationsTable,
  actesConsultationsTable,
  actesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../middlewares/errorHandler";
import { logger } from "../lib/logger";

export interface MontantsFacture {
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
}

export class FactureService {
  static async recalculerDepuisActes(consultationId: number, clinicId: string): Promise<MontantsFacture> {
    const actes = await db
      .select({
        quantite: actesConsultationsTable.quantite,
        prixUnitaireHT: actesConsultationsTable.prixUnitaire,
        tauxTVA: actesTable.tvaRate,
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .where(
        and(
          eq(actesConsultationsTable.consultationId, consultationId),
          eq(actesConsultationsTable.clinicId, clinicId),
        ),
      );

    let montantHT = 0;
    let montantTVA = 0;

    for (const a of actes) {
      const ht = Number(a.quantite) * Number(a.prixUnitaireHT ?? 0);
      const tva = ht * (Number(a.tauxTVA ?? 20) / 100);
      montantHT += ht;
      montantTVA += tva;
    }

    return {
      montantHT: Math.round(montantHT * 100) / 100,
      montantTVA: Math.round(montantTVA * 100) / 100,
      montantTTC: Math.round((montantHT + montantTVA) * 100) / 100,
    };
  }

  /**
   * Generate a sequential invoice number scoped to (clinicId, year).
   *
   * MUST be called inside a db.transaction() so that the advisory lock,
   * the COUNT query, and the INSERT all share the same PG connection/transaction.
   * The lock is released automatically when the transaction commits or rolls back.
   *
   * @param tx  - Drizzle transaction object (from db.transaction callback)
   * @param clinicId - Clerk organisation string ID (e.g. "org_xxx")
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async genererNumero(tx: any, clinicId: string): Promise<string> {
    const year = new Date().getFullYear();

    // Derive an int4 advisory lock key from the string clinicId using PostgreSQL
    // hashtext(). XOR with year to prevent cross-year contention.
    const lockRaw = await tx.execute(
      sql`SELECT hashtext(${clinicId} || '_' || ${String(year)}) AS lock_key`,
    );
    const lockRows: Record<string, unknown>[] = Array.isArray(lockRaw)
      ? (lockRaw[0]?.rows ?? lockRaw)
      : (lockRaw.rows ?? lockRaw);
    const lockKey = Number(lockRows[0]["lock_key"]);

    // Acquire advisory lock — held until this transaction ends (xact-scoped).
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

    // COUNT existing invoices for this clinic + year INSIDE the same transaction.
    const countRaw = await tx.execute(
      sql`SELECT COUNT(*) AS count
           FROM factures
           WHERE clinic_id = ${clinicId}
           AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Europe/Paris') = ${year}`,
    );
    const countRows: Record<string, unknown>[] = Array.isArray(countRaw)
      ? (countRaw[0]?.rows ?? countRaw)
      : (countRaw.rows ?? countRaw);
    const count = Number(countRows[0]["count"]) + 1;

    return `FAC-${year}-${String(count).padStart(5, "0")}`;
  }

  static async verifierExistence(
    factureId: number,
  ): Promise<typeof facturesTable.$inferSelect> {
    const [facture] = await db
      .select()
      .from(facturesTable)
      .where(eq(facturesTable.id, factureId))
      .limit(1);

    if (!facture) {
      throw new NotFoundError("Facture");
    }

    return facture;
  }

  static async validerPaiement(
    factureId: number,
    modePaiement: string,
    montantEspecesRecu?: number,
  ): Promise<{ renduMonnaie?: number }> {
    const facture = await this.verifierExistence(factureId);

    if (facture.statut === "payee") {
      throw new ValidationError("Cette facture est deja payee");
    }

    const montants = await this.recalculerDepuisActes(facture.consultationId);

    let renduMonnaie: number | undefined;

    if (modePaiement === "especes") {
      if (!montantEspecesRecu) {
        throw new ValidationError("Montant recu en especes requis");
      }
      if (montantEspecesRecu < montants.montantTTC) {
        throw new ValidationError(
          `Montant insuffisant : ${montants.montantTTC.toFixed(2)} EUR requis`,
        );
      }
      renduMonnaie =
        Math.round((montantEspecesRecu - montants.montantTTC) * 100) / 100;
    }

    await db
      .update(facturesTable)
      .set({
        statut: "payee",
        modePaiement,
        montantHT: montants.montantHT,
        tva: 20,
        montantTTC: montants.montantTTC,
        datePaiement: new Date().toISOString(),
        ...(montantEspecesRecu !== undefined && { montantEspecesRecu }),
        updatedAt: new Date(),
      })
      .where(eq(facturesTable.id, factureId));

    logger.info(
      { factureId, modePaiement, montantTTC: montants.montantTTC },
      "Facture payee",
    );

    return { renduMonnaie };
  }

  static async obtenirAvecConsultation(factureId: number) {
    const facture = await this.verifierExistence(factureId);

    const [consultation] = await db
      .select()
      .from(consultationsTable)
      .where(eq(consultationsTable.id, facture.consultationId))
      .limit(1);

    if (!consultation) {
      throw new NotFoundError("Consultation liee a la facture");
    }

    return { facture, consultation };
  }
}
