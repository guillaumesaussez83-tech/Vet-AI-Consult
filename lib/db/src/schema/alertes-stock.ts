import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMedicamentsTable } from "./stock-medicaments";

export const TYPES_ALERTE = [
  "rupture", "stock_bas", "peremption_proche", "peremption_30j", "surstockage", "commande_suggeree",
] as const;

export const NIVEAUX_URGENCE = ["critique", "warning", "info"] as const;

export const alertesStockTable = pgTable("alertes_stock", {
  id: serial("id").primaryKey(),
  medicamentId: integer("medicament_id").references(() => stockMedicamentsTable.id),
  typeAlerte: text("type_alerte").notNull(),
  niveauUrgence: text("niveau_urgence").notNull().default("warning"),
  message: text("message").notNull(),
  estTraitee: boolean("est_traitee").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  medicamentIdIdx: index("idx_alertes_stock_medicament_id").on(table.medicamentId),
  traiteeIdx: index("idx_alertes_stock_traitee").on(table.estTraitee),
}));

export const insertAlerteStockSchema = createInsertSchema(alertesStockTable).omit({ id: true, createdAt: true });
export type InsertAlerteStock = z.infer<typeof insertAlerteStockSchema>;
export type AlerteStock = typeof alertesStockTable.$inferSelect;
