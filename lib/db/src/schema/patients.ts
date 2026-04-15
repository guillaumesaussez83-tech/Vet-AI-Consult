import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ownersTable } from "./owners";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  espece: text("espece").notNull(),
  race: text("race"),
  sexe: text("sexe").notNull(),
  dateNaissance: text("date_naissance"),
  poids: real("poids"),
  couleur: text("couleur"),
  sterilise: boolean("sterilise").notNull().default(false),
  ownerId: integer("owner_id").notNull().references(() => ownersTable.id),
  antecedents: text("antecedents"),
  allergies: text("allergies"),
  puce: text("puce"),
  passeport: text("passeport"),
  assurance: boolean("assurance").notNull().default(false),
  assuranceNom: text("assurance_nom"),
  agressif: boolean("agressif").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
