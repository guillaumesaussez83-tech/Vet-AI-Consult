import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ownersTable = pgTable("owners", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email"),
  telephone: text("telephone").notNull(),
  adresse: text("adresse"),
  rgpdAccepted: boolean("rgpd_accepted").notNull().default(false),
  rgpdAcceptedAt: timestamp("rgpd_accepted_at", { withTimezone: true }),
  rgpdDocumentUrl: text("rgpd_document_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOwnerSchema = createInsertSchema(ownersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof ownersTable.$inferSelect;
