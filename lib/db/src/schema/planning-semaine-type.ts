import { pgTable, text, boolean, integer, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { veterinairesTable } from "./veterinaires";

export const planningSeamineTypeTable = pgTable("planning_semaine_type", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: text("clinic_id").notNull().default("default"),
  veterinaireId: text("veterinaire_id").notNull().references(() => veterinairesTable.id, { onDelete: "cascade" }),
  jourSemaine: integer("jour_semaine").notNull(), // 0=Lundi ... 6=Dimanche
  heureDebut: text("heure_debut").notNull().default("08:30"),
  heureFin: text("heure_fin").notNull().default("19:00"),
  pauseDebut: text("pause_debut"),
  pauseFin: text("pause_fin"),
  actif: boolean("actif").notNull().default(true),
}, (table) => ({
  clinicIdIdx: index("idx_planning_semaine_clinic_id").on(table.clinicId),
  vetJourUnique: unique("unique_vet_jour").on(table.veterinaireId, table.jourSemaine),
}));

export const insertPlanningSemaineTypeSchema = createInsertSchema(planningSeamineTypeTable).omit({ id: true });
export type InsertPlanningSemaineType = z.infer<typeof insertPlanningSemaineTypeSchema>;
export type PlanningSemaineType = typeof planningSeamineTypeTable.$inferSelect;
