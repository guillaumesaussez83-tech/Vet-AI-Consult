import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const vaccinationsTable = pgTable("vaccinations", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  nomVaccin: text("nom_vaccin").notNull(),
  dateInjection: text("date_injection").notNull(),
  dateRappel: text("date_rappel"),
  lotNumero: text("lot_numero"),
  fabricant: text("fabricant"),
  voieInjection: text("voie_injection"),
  veterinaire: text("veterinaire"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__vaccinations").on(table.clinicId),
  patientIdIdx: index("idx_vaccinations_patient_id").on(table.patientId),
  dateRappelIdx: index("idx_vaccinations_date_rappel").on(table.dateRappel),
}));

export const insertVaccinationSchema = createInsertSchema(vaccinationsTable).omit({ id: true, createdAt: true });
export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;
export type Vaccination = typeof vaccinationsTable.$inferSelect;
