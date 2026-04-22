import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Tenant racine — chaque clinique vétérinaire est isolée par cet ID.
 * Toutes les tables métier référencent clinics.id via une colonne clinicId text.
 * La clinique "default" est seedée automatiquement pour la rétrocompat.
 */
export const clinicsTable = pgTable("clinics", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("idx_clinics_slug").on(table.slug),
}));

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ createdAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;
