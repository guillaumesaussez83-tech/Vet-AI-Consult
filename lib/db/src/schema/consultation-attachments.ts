import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";

export const consultationAttachmentsTable = pgTable("consultation_attachments", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id")
    .notNull()
    .references(() => consultationsTable.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  dataBase64: text("data_base64").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConsultationAttachment = typeof consultationAttachmentsTable.$inferSelect;
export type NewConsultationAttachment = typeof consultationAttachmentsTable.$inferInsert;
