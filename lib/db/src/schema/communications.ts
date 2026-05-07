import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const communicationsTable = pgTable("communications", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  type: text("type").notNull(), // POST_CONSULTATION, VACCINATION_REMINDER, RELANCE_IMPAYE, CUSTOM
  channel: text("channel").notNull().default("email"), // email, sms
  recipientId: integer("recipient_id"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  recipientName: text("recipient_name"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").notNull().default("PENDING"), // PENDING, SENT, FAILED
  refId: integer("ref_id"),
  refType: text("ref_type"), // consultation, invoice, vaccination
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
