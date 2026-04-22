import { pgTable, text, serial, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { commandesCentravetTable } from "./commandes-centravet";

export const bonsLivraisonTable = pgTable("bons_livraison", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  commandeId: integer("commande_id").references(() => commandesCentravetTable.id),
  numeroBL: text("numero_bl"),
  dateLivraison: text("date_livraison"),
  statut: text("statut").notNull().default("a_valider"),
  validePar: text("valide_par"),
  dateValidation: timestamp("date_validation", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__bons_livraison").on(table.clinicId),
  commandeIdIdx: index("idx_bons_livraison_commande_id").on(table.commandeId),
  uniqClinicNumero: uniqueIndex("uniq_bons_livraison_clinic_numero").on(table.clinicId, table.numeroBL),
}));

export const insertBonLivraisonSchema = createInsertSchema(bonsLivraisonTable).omit({ id: true, createdAt: true });
export type InsertBonLivraison = z.infer<typeof insertBonLivraisonSchema>;
export type BonLivraison = typeof bonsLivraisonTable.$inferSelect;
