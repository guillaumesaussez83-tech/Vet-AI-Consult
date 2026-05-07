import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const letterTypeEnum = pgEnum("letter_type", [
  "RELANCE", "CONVOCATION", "INFORMATION", "BILAN", "AUTRE"
]);

export const clientLettersTable = pgTable("client_letters", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  patientId: integer("patient_id"),
  type: letterTypeEnum("type").default("AUTRE"),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});