import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockMedicamentsTable = pgTable("stock_medicaments", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  reference: text("reference"),
  quantiteStock: integer("quantite_stock").notNull().default(0),
  quantiteMinimum: integer("quantite_minimum").notNull().default(5),
  prixAchatHT: real("prix_achat_ht"),
  prixVenteTTC: real("prix_vente_ttc"),
  fournisseur: text("fournisseur"),
  datePeremption: text("date_peremption"),
  emplacement: text("emplacement"),
  unite: text("unite").default("unité"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  nomIdx: index("idx_stock_medicaments_nom").on(table.nom),
}));

export const insertStockMedicamentSchema = createInsertSchema(stockMedicamentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockMedicament = z.infer<typeof insertStockMedicamentSchema>;
export type StockMedicament = typeof stockMedicamentsTable.$inferSelect;
