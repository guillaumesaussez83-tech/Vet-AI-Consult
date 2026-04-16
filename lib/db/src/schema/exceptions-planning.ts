import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { veterinairesTable } from "./veterinaires";

export const exceptionsPlanningTable = pgTable("exceptions_planning", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: text("clinic_id").notNull().default("default"),
  veterinaireId: text("veterinaire_id").notNull().references(() => veterinairesTable.id, { onDelete: "cascade" }),
  dateDebut: text("date_debut").notNull(), // YYYY-MM-DD
  dateFin: text("date_fin").notNull(),     // YYYY-MM-DD
  typeException: text("type_exception").notNull(), // conge|maladie|formation|garde_exceptionnelle|fermeture_clinique
  motif: text("motif"),
  heureDebutOverride: text("heure_debut_override"),
  heureFinOverride: text("heure_fin_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_exceptions_planning_clinic_id").on(table.clinicId),
  vetIdIdx: index("idx_exceptions_planning_vet_id").on(table.veterinaireId),
}));

export const insertExceptionPlanningSchema = createInsertSchema(exceptionsPlanningTable).omit({ id: true, createdAt: true });
export type InsertExceptionPlanning = z.infer<typeof insertExceptionPlanningSchema>;
export type ExceptionPlanning = typeof exceptionsPlanningTable.$inferSelect;
