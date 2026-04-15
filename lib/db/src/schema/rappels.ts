import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rappelsModelesTable = pgTable("rappels_modeles", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  description: text("description"),
  periodiciteJours: integer("periodicite_jours").notNull().default(365),
  actif: boolean("actif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRappelModeleSchema = createInsertSchema(rappelsModelesTable).omit({ id: true, createdAt: true });
export type InsertRappelModele = z.infer<typeof insertRappelModeleSchema>;
export type RappelModele = typeof rappelsModelesTable.$inferSelect;
