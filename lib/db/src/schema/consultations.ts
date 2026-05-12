import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";

export const consultationsTable = pgTable("consultations", {
    id: serial("id").primaryKey(),
    clinicId: text("clinic_id").notNull(), // HARDENING: no silent fallback — requireClinicId middleware must always supply this
    patientId: integer("patient_id").notNull().references(() => patientsTable.id),
    veterinaire: text("veterinaire").notNull(),
    veterinaireId: text("veterinaire_id"),
    veterinaireName: text("veterinaire_name"),
    date: text("date").notNull(),
    statut: text("statut").notNull().default("en_attente"),
    motif: text("motif"),
    anamnese: text("anamnese"),
    examenClinique: text("examen_clinique"),
    examensComplementaires: text("examens_complementaires"),
    diagnostic: text("diagnostic"),
    diagnosticIA: text("diagnostic_ia"),
    ordonnance: text("ordonnance"),
    notes: text("notes"),
    poids: real("poids"),
    temperature: real("temperature"),
    // Workflow dual-phase IA
    phase: text("phase").default("ANAMNESE"),
    anamneseIA: text("anamnese_ia"),
    examenIA: text("examen_ia"),
    examensComplementairesValides: text("examens_complementaires_valides"),
    syntheseIA: text("synthese_ia"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    clinicIdIdx: index("idx_clinic_id__consultations").on(table.clinicId),
    patientIdIdx: index("idx_consultations_patient_id").on(table.patientId),
    dateIdx: index("idx_consultations_date").on(table.date),
    statutIdx: index("idx_consultations_statut").on(table.statut),
}));

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultationsTable.$inferSelect;
