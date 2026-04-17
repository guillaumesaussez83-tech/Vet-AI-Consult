import { db } from "@workspace/db";
import {
  facturesTable,
  consultationsTable,
  actesConsultationsTable,
  actesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../middlewares/errorHandler";
import { logger } from "../lib/logger";

export interface MontantsFacture {
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
}

export class FactureService {
  static async recalculerDepuisActes(consultationId: number): Promise<MontantsFacture> {
    const actes = await db
      .select({
        quantite: actesConsultationsTable.quantite,
        prixUnitaireHT: actesTable.prix,
        tauxTVA: actesTable.tvaRate,
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .where(eq(actesConsultationsTable.consultationId, consultationId));

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

  static async genererNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");

    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM factures
          WHERE EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC') = ${year}`,
    );

    const count =
      Number((result.rows[0] as Record<string, unknown>)["count"]) + 1;
    return `FAC-${year}${month}-${String(count).padStart(4, "0")}`;
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
      throw new ValidationError("Cette facture est déjà payée");
    }

    const montants = await this.recalculerDepuisActes(facture.consultationId);

    let renduMonnaie: number | undefined;

    if (modePaiement === "especes") {
      if (!montantEspecesRecu) {
        throw new ValidationError("Montant reçu en espèces requis");
      }
      if (montantEspecesRecu < montants.montantTTC) {
        throw new ValidationError(
          `Montant insuffisant : ${montants.montantTTC.toFixed(2)} € requis`,
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
      "Facture payée",
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
      throw new NotFoundError("Consultation liée à la facture");
    }

    return { facture, consultation };
  }
}
