import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actesTable = pgTable("actes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nom: text("nom").notNull(),
  categorie: text("categorie").notNull(),
  prixDefaut: real("prix_defaut").notNull(),
  description: text("description"),
  unite: text("unite").notNull().default("unité"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActeSchema = createInsertSchema(actesTable).omit({ id: true, createdAt: true });
export type InsertActe = z.infer<typeof insertActeSchema>;
export type Acte = typeof actesTable.$inferSelect;
