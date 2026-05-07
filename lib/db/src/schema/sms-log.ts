import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const smsStatusEnum = pgEnum("sms_status", ["PENDING", "SENT", "FAILED", "DELIVERED"]);
export const smsTypeEnum = pgEnum("sms_type", ["RAPPEL_J3", "RAPPEL_J1", "CONFIRMATION", "CUSTOM"]);

export const smsLogTable = pgTable("sms_log", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  rdvId: integer("rdv_id"),
  ownerId: integer("owner_id"),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  type: smsTypeEnum("type").default("CUSTOM"),
  status: smsStatusEnum("status").default("PENDING"),
  twilioSid: text("twilio_sid"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});