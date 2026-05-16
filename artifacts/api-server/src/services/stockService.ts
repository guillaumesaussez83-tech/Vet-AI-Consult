import { db } from "@workspace/db";
import { stockMedicamentsTable, mouvementsStockTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, ValidationError, AppError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

export type TypeMouvement =
  | "entree_reception"
  | "sortie_consultation"
  | "sortie_vente"
  | "perte_peremption"
  | "ajustement_inventaire"
  | "retour_fournisseur";

export interface MouvementParams {
  medicamentId: number;
  type: TypeMouvement;
  quantite: number;
  motif: string;
  consultationId?: number;
  factureId?: number;
  utilisateur?: string;
  lotId?: number;
}

export class StockService {
  static async verifierDisponibilite(
    medicamentId: number,
    quantiteRequise: number,
  ): Promise<typeof stockMedicamentsTable.$inferSelect> {
    const [stock] = await db
      .select()
      .from(stockMedicamentsTable)
      .where(eq(stockMedicamentsTable.id, medicamentId))
      .limit(1);

    if (!stock) {
      throw new NotFoundError("Médicament");
    }

    if (!stock.actif) {
      throw new ValidationError("Ce médicament n'est plus actif");
    }

    if (stock.quantiteStock < quantiteRequise) {
      throw new AppError(
        409,
        `Stock insuffisant : ${stock.quantiteStock} disponible, ${quantiteRequise} requis`,
        "STOCK_INSUFFISANT",
        { stockActuel: stock.quantiteStock, quantiteRequise },
      );
    }

    if (stock.estStupefiant) {
      throw new AppError(
        400,
        "Ce médicament est un stupéfiant — utiliser l'endpoint dédié /api/stock/stupefiants",
        "STUPEFIANT_REQUIRED",
      );
    }

    return stock;
  }

  static async creerMouvement(params: MouvementParams): Promise<void> {
    const isSortie = params.type.startsWith("sortie") || params.type === "perte_peremption";
    const delta = isSortie ? -params.quantite : params.quantite;

    await db.transaction(async (tx) => {
      await tx.insert(mouvementsStockTable).values({
        medicamentId: params.medicamentId,
        lotId: params.lotId,
        typeMouvement: params.type,
        quantite: params.quantite,
        consultationId: params.consultationId,
        factureId: params.factureId,
        motif: params.motif,
        utilisateur: params.utilisateur,
      });

      await tx
        .update(stockMedicamentsTable)
        .set({
          quantiteStock: sql`quantite_stock + ${delta}`,
          updatedAt: new Date(),
        })
        .where(eq(stockMedicamentsTable.id, params.medicamentId));
    });

    logger.info(
      {
        medicamentId: params.medicamentId,
        type: params.type,
        quantite: params.quantite,
        delta,
      },
      "Mouvement stock créé",
    );
  }

  static async alerterSiSeuil(medicamentId: number): Promise<void> {
    const [stock] = await db
      .select({
        nom: stockMedicamentsTable.nom,
        quantiteStock: stockMedicamentsTable.quantiteStock,
        quantiteMinimum: stockMedicamentsTable.quantiteMinimum,
      })
      .from(stockMedicamentsTable)
      .where(eq(stockMedicamentsTable.id, medicamentId))
      .limit(1);

    if (stock && stock.quantiteStock <= stock.quantiteMinimum) {
      logger.warn(
        {
          medicamentId,
          nom: stock.nom,
          quantiteStock: stock.quantiteStock,
          quantiteMinimum: stock.quantiteMinimum,
        },
        "Alerte stock bas",
      );
    }
  }

  static async obtenirOuEchouer(medicamentId: number): Promise<typeof stockMedicamentsTable.$inferSelect> {
    const [stock] = await db
      .select()
      .from(stockMedicamentsTable)
      .where(and(
        eq(stockMedicamentsTable.id, medicamentId),
        eq(stockMedicamentsTable.actif, true),
      ))
      .limit(1);

    if (!stock) throw new NotFoundError("Médicament");
    return stock;
  }
}
