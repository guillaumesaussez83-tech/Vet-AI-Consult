import { pgTable, text, serial, timestamp, integer, real, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CATEGORIES_STOCK = ["medicament", "vaccin", "consommable", "aliment", "materiel"] as const;
export const UNITES_STOCK = ["comprime", "flacon", "ml", "boite", "sachet", "unite"] as const;

export const stockMedicamentsTable = pgTable("stock_medicaments", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  reference: text("reference"),
  referenceCentravet: text("reference_centravet"),
  codeEan: text("code_ean"),
  categorie: text("categorie").default("medicament"),
  quantiteStock: integer("quantite_stock").notNull().default(0),
  quantiteMinimum: integer("quantite_minimum").notNull().default(5),
  quantiteMax: real("quantite_max"),
  pointCommande: real("point_commande"),
  quantiteCommandeOptimale: real("quantite_commande_optimale"),
  prixAchatHT: real("prix_achat_ht"),
  prixVenteTTC: real("prix_vente_ttc"),
  tvaTaux: real("tva_taux").default(20),
  fournisseur: text("fournisseur"),
  fournisseurPrincipal: text("fournisseur_principal").default("CENTRAVET"),
  delaiLivraisonJours: integer("delai_livraison_jours").default(1),
  datePeremption: text("date_peremption"),
  datePeremptionLot: text("date_peremption_lot"),
  emplacement: text("emplacement"),
  unite: text("unite").default("unité"),
  estStupefiant: boolean("est_stupefiant").default(false),
  actif: boolean("actif").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  nomIdx: index("idx_stock_medicaments_nom").on(table.nom),
}));

export const insertStockMedicamentSchema = createInsertSchema(stockMedicamentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockMedicament = z.infer<typeof insertStockMedicamentSchema>;
export type StockMedicament = typeof stockMedicamentsTable.$inferSelect;
