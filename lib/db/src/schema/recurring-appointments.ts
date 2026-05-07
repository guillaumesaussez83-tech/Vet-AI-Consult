import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"
]);

export const recurringAppointmentsTable = pgTable("recurring_appointments", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: integer("patient_id"),
  ownerId: integer("owner_id"),
  veterinaire: text("veterinaire"),
  veterinaireId: text("veterinaire_id"),
  motif: text("motif"),
  typeRdv: text("type_rdv").default("CONSULTATION"),
  dureeMinutes: integer("duree_minutes").default(30),
  frequency: recurringFrequencyEnum("frequency").default("MONTHLY"),
  dayOfWeek: integer("day_of_week"),
  timeOfDay: text("time_of_day").default("09:00"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  active: boolean("active").default(true),
  notes: text("notes"),
  lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});