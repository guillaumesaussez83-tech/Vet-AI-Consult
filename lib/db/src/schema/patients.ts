import { pgTable, text, serial, timestamp, integer, boolean, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ownersTable } from "./owners";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
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
  consentementRgpd: boolean("consentement_rgpd").notNull().default(false),
  dateConsentement: timestamp("date_consentement", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__patients").on(table.clinicId),
  ownerIdIdx: index("idx_patients_owner_id").on(table.ownerId),
  especeIdx: index("idx_patients_espece").on(table.espece),
  nomIdx: index("idx_patients_nom").on(table.nom),
}));

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
