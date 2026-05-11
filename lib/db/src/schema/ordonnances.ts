import { pgTable, text, serial, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";

export const ordonnancesTable = pgTable("ordonnances", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  consultationId: integer("consultation_id").notNull().references(() => consultationsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  veterinaire: text("veterinaire"),
  contenu: text("contenu").notNull(),
  numeroOrdonnance: text("numero_ordonnance"),
  numeroAmm: text("numero_amm"), // N° AMM UE 2019/6
  genereIA: boolean("genere_ia").default(false),
  instructionsClient: text("instructions_client"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__ordonnances").on(table.clinicId),
  consultationIdIdx: index("idx_ordonnances_consultation_id").on(table.consultationId),
  patientIdIdx: index("idx_ordonnances_patient_id").on(table.patientId),
  uniqClinicNumero: uniqueIndex("uniq_ordonnances_clinic_numero").on(table.clinicId, table.numeroOrdonnance),
}));

export const insertOrdonnanceSchema = createInsertSchema(ordonnancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrdonnance = z.infer<typeof insertOrdonnanceSchema>;
export type Ordonnance = typeof ordonnancesTable.$inferSelect;
