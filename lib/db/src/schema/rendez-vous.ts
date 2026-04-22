import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { ownersTable } from "./owners";
import { veterinairesTable } from "./veterinaires";

export const rendezVousTable = pgTable("rendez_vous", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  dateHeure: text("date_heure").notNull(),
  dureeMinutes: integer("duree_minutes").notNull().default(20),
  patientId: integer("patient_id").references(() => patientsTable.id),
  ownerId: integer("owner_id").references(() => ownersTable.id),
  veterinaire: text("veterinaire"),
  veterinaireId: text("veterinaire_id").references(() => veterinairesTable.id),
  motif: text("motif"),
  typeRdv: text("type_rdv").default("consultation"), // consultation|vaccination|chirurgie|urgence|suivi|bilan|autre
  proprietaireNom: text("proprietaire_nom"),
  proprietaireTelephone: text("proprietaire_telephone"),
  animalNom: text("animal_nom"),
  animalEspece: text("animal_espece"), // chien|chat|nac|cheval|autre
  statut: text("statut").notNull().default("planifié"),
  statutSalle: text("statut_salle").notNull().default("en_attente_arrivee"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__rendez_vous").on(table.clinicId),
  dateHeureIdx: index("idx_rendez_vous_date_heure").on(table.dateHeure),
  patientIdIdx: index("idx_rendez_vous_patient_id").on(table.patientId),
  ownerIdIdx: index("idx_rendez_vous_owner_id").on(table.ownerId),
  vetIdIdx: index("idx_rendez_vous_vet_id").on(table.veterinaireId),
}));

export const insertRendezVousSchema = createInsertSchema(rendezVousTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRendezVous = z.infer<typeof insertRendezVousSchema>;
export type RendezVous = typeof rendezVousTable.$inferSelect;
