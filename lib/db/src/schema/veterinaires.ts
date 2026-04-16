import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const veterinairesTable = pgTable("veterinaires", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: text("clinic_id").notNull().default("default"),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  rpps: text("rpps"),
  couleur: text("couleur").notNull().default("#2563EB"),
  initiales: text("initiales"),
  actif: boolean("actif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_veterinaires_clinic_id").on(table.clinicId),
}));

export const insertVeterinaireSchema = createInsertSchema(veterinairesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVeterinaire = z.infer<typeof insertVeterinaireSchema>;
export type Veterinaire = typeof veterinairesTable.$inferSelect;
