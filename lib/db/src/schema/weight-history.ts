import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";

export const weightHistoryTable = pgTable("weight_history", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: integer("patient_id").notNull(),
  weight: real("weight").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).defaultNow(),
  consultationId: integer("consultation_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});