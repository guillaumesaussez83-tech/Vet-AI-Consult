import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";
import { clinicsTable } from "./clinics";

export const consultationAttachmentsTable = pgTable("consultation_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  consultationId: uuid("consultation_id")
    .notNull()
    .references(() => consultationsTable.id, { onDelete: "cascade" }),
  clinicId: text("clinic_id")
    .notNull()
    .references(() => clinicsTable.id),

  // Colonnes de stockage par référence (nouvelle architecture)
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),

  // Colonne legacy base64 — nullable pour migration progressive
  dataBase64: text("data_base64"),

  nom: text("nom"),
  type: text("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
