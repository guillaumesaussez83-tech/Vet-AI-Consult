import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { actesTable } from "./actes";
import { consultationsTable } from "./consultations";

export const actesConsultationsTable = pgTable("actes_consultations", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  acteId: integer("acte_id").references(() => actesTable.id),
  consultationId: integer("consultation_id").notNull().references(() => consultationsTable.id),
  quantite: integer("quantite").notNull().default(1),
  prixUnitaire: real("prix_unitaire").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__actes_consultations").on(table.clinicId),
  consultationIdIdx: index("idx_actes_consultations_consultation_id").on(table.consultationId),
  acteIdIdx: index("idx_actes_consultations_acte_id").on(table.acteId),
}));

export const insertActeConsultationSchema = createInsertSchema(actesConsultationsTable).omit({ id: true, createdAt: true });
export type InsertActeConsultation = z.infer<typeof insertActeConsultationSchema>;
export type ActeConsultation = typeof actesConsultationsTable.$inferSelect;
