import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const relancesTable = pgTable("relances", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  sentBy: text("sent_by").notNull(),
  channel: text("channel").notNull().default("email"),
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  message: text("message"),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
