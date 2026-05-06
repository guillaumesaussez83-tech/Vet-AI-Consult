import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";

export const consultationPatientsTable = pgTable(
  "consultation_patients",
  {
    id: serial("id").primaryKey(),
    consultationId: integer("consultation_id")
      .notNull()
      .references(() => consultationsTable.id, { onDelete: "cascade" }),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: unique().on(t.consultationId, t.patientId),
  })
);

export type ConsultationPatient = typeof consultationPatientsTable.$inferSelect;
export type NewConsultationPatient = typeof consultationPatientsTable.$inferInsert;
