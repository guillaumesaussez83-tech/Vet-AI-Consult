import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { veterinairesTable } from "./veterinaires";

export const rotationsWeekendTable = pgTable("rotations_weekend", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: text("clinic_id").notNull().default("default"),
  dateWeekend: text("date_weekend").notNull(), // YYYY-MM-DD (always Saturday)
  veterinaireId: text("veterinaire_id").notNull().references(() => veterinairesTable.id, { onDelete: "cascade" }),
  typeGarde: text("type_garde").notNull(), // samedi|dimanche|weekend_complet
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_rotations_weekend_clinic_id").on(table.clinicId),
  uniqueGarde: unique("unique_clinic_weekend_garde").on(table.clinicId, table.dateWeekend, table.typeGarde),
}));

export const insertRotationWeekendSchema = createInsertSchema(rotationsWeekendTable).omit({ id: true, createdAt: true });
export type InsertRotationWeekend = z.infer<typeof insertRotationWeekendSchema>;
export type RotationWeekend = typeof rotationsWeekendTable.$inferSelect;
