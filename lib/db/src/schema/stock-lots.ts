import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMedicamentsTable } from "./stock-medicaments";

export const stockLotsTable = pgTable("stock_lots", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  medicamentId: integer("medicament_id").notNull().references(() => stockMedicamentsTable.id),
  numeroLot: text("numero_lot"),
  datePeremption: text("date_peremption").notNull(),
  quantiteInitiale: real("quantite_initiale"),
  quantiteRestante: real("quantite_restante"),
  dateReception: text("date_reception"),
  bonLivraisonId: integer("bon_livraison_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__stock_lots").on(table.clinicId),
  medicamentIdIdx: index("idx_stock_lots_medicament_id").on(table.medicamentId),
  datePeremptionIdx: index("idx_stock_lots_date_peremption").on(table.datePeremption),
}));

export const insertStockLotSchema = createInsertSchema(stockLotsTable).omit({ id: true, createdAt: true });
export type InsertStockLot = z.infer<typeof insertStockLotSchema>;
export type StockLot = typeof stockLotsTable.$inferSelect;
