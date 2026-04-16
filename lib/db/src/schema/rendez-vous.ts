import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { ownersTable } from "./owners";

export const rendezVousTable = pgTable("rendez_vous", {
  id: serial("id").primaryKey(),
  dateHeure: text("date_heure").notNull(),
  dureeMinutes: integer("duree_minutes").notNull().default(30),
  patientId: integer("patient_id").references(() => patientsTable.id),
  ownerId: integer("owner_id").references(() => ownersTable.id),
  veterinaire: text("veterinaire"),
  motif: text("motif"),
  statut: text("statut").notNull().default("planifié"),
  statutSalle: text("statut_salle").notNull().default("en_attente_arrivee"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  dateHeureIdx: index("idx_rendez_vous_date_heure").on(table.dateHeure),
  patientIdIdx: index("idx_rendez_vous_patient_id").on(table.patientId),
  ownerIdIdx: index("idx_rendez_vous_owner_id").on(table.ownerId),
}));

export const insertRendezVousSchema = createInsertSchema(rendezVousTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRendezVous = z.infer<typeof insertRendezVousSchema>;
export type RendezVous = typeof rendezVousTable.$inferSelect;
