import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMedicamentsTable } from "./stock-medicaments";

export const TYPES_MOUVEMENT = [
  "entree_reception", "sortie_consultation", "sortie_vente",
  "perte_peremption", "ajustement_inventaire", "retour_fournisseur",
] as const;

export const mouvementsStockTable = pgTable("mouvements_stock", {
  id: serial("id").primaryKey(),
  medicamentId: integer("medicament_id").notNull().references(() => stockMedicamentsTable.id),
  lotId: integer("lot_id"),
  typeMouvement: text("type_mouvement").notNull(),
  quantite: real("quantite").notNull(),
  consultationId: integer("consultation_id"),
  factureId: integer("facture_id"),
  bonLivraisonId: integer("bon_livraison_id"),
  prixUnitaireHT: real("prix_unitaire_ht"),
  motif: text("motif"),
  utilisateur: text("utilisateur"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  medicamentIdIdx: index("idx_mouvements_stock_medicament_id").on(table.medicamentId),
  typeMouvementIdx: index("idx_mouvements_stock_type").on(table.typeMouvement),
  createdAtIdx: index("idx_mouvements_stock_created_at").on(table.createdAt),
}));

export const insertMouvementStockSchema = createInsertSchema(mouvementsStockTable).omit({ id: true, createdAt: true });
export type InsertMouvementStock = z.infer<typeof insertMouvementStockSchema>;
export type MouvementStock = typeof mouvementsStockTable.$inferSelect;
