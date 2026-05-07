import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";

export const vaccinationsTable = pgTable("vaccinations", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: integer("patient_id").notNull(),
  ownerId: integer("owner_id"),
  vaccineType: text("vaccine_type").notNull(), // RAGE, HEPATITE, LEPTO, PARVO, HERPES, etc.
  vaccineName: text("vaccine_name"),
  vaccineDate: date("vaccine_date").notNull(),
  nextDueDate: date("next_due_date"),
  batchNumber: text("batch_number"),
  notes: text("notes"),
  consultationId: integer("consultation_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vaccinationRemindersTable = pgTable("vaccination_reminders", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  vaccinationId: integer("vaccination_id").notNull(),
  patientId: integer("patient_id").notNull(),
  ownerId: integer("owner_id"),
  reminderDate: date("reminder_date").notNull(),
  channel: text("channel").notNull().default("email"),
  status: text("status").notNull().default("PENDING"), // PENDING, SENT, FAILED, CANCELLED
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
