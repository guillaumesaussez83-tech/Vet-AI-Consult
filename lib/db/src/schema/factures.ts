import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";

export const facturesTable = pgTable("factures", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  consultationId: integer("consultation_id").notNull().references(() => consultationsTable.id).unique(),
  numero: text("numero").notNull().unique(),
  montantHT: real("montant_ht").notNull(),
  tva: real("tva").notNull().default(20),
  montantTTC: real("montant_ttc").notNull(),
  statut: text("statut").notNull().default("en_attente"),
  dateEmission: text("date_emission").notNull(),
  datePaiement: text("date_paiement"),
  modePaiement: text("mode_paiement"),
  montantEspecesRecu: real("montant_especes_recu"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__factures").on(table.clinicId),
  consultationIdIdx: index("idx_factures_consultation_id").on(table.consultationId),
  statutIdx: index("idx_factures_statut").on(table.statut),
  dateEmissionIdx: index("idx_factures_date_emission").on(table.dateEmission),
}));

export const insertFactureSchema = createInsertSchema(facturesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFacture = z.infer<typeof insertFactureSchema>;
export type Facture = typeof facturesTable.$inferSelect;
