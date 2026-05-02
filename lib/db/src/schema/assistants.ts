import { pgTable, text, serial, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assistantsTable = pgTable("assistants", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  clerkUserId: text("clerk_user_id"),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email"),
  telephone: text("telephone"),
  role: text("role").notNull().default("assistante"),
  initiales: text("initiales"),
  actif: boolean("actif").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__assistants").on(table.clinicId),
  clerkUserIdIdx: index("idx_assistants_clerk_user_id").on(table.clerkUserId),
  uniqClinicClerk: uniqueIndex("uniq_assistants_clinic_clerk").on(table.clinicId, table.clerkUserId),
}));

export const insertAssistantSchema = createInsertSchema(assistantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssistant = z.infer<typeof insertAssistantSchema>;
export type Assistant = typeof assistantsTable.$inferSelect;
