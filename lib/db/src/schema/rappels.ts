import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";

export const rappelsModelesTable = pgTable("rappels_modeles", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  description: text("description"),
  periodiciteJours: integer("periodicite_jours").notNull().default(365),
  actif: boolean("actif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rappelsTable = pgTable("rappels", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").references(() => consultationsTable.id, { onDelete: "set null" }),
  patientId: integer("patient_id").references(() => patientsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  joursDelai: integer("jours_delai"),
  dateEcheance: text("date_echeance"),
  statut: text("statut").notNull().default("actif"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  consultationIdIdx: index("idx_rappels_consultation_id").on(table.consultationId),
  patientIdIdx: index("idx_rappels_patient_id").on(table.patientId),
  statutIdx: index("idx_rappels_statut").on(table.statut),
}));

export const insertRappelModeleSchema = createInsertSchema(rappelsModelesTable).omit({ id: true, createdAt: true });
export type InsertRappelModele = z.infer<typeof insertRappelModeleSchema>;
export type RappelModele = typeof rappelsModelesTable.$inferSelect;

export const insertRappelSchema = createInsertSchema(rappelsTable).omit({ id: true, createdAt: true });
export type InsertRappel = z.infer<typeof insertRappelSchema>;
export type Rappel = typeof rappelsTable.$inferSelect;
