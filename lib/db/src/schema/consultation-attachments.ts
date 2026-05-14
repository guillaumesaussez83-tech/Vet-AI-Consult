import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";

// ──────────────────────────────────────────────────────────────────────────────
// SCHEMA NOTE (fix 2025-05-12 — hardening/final-production-review)
//
// SQL column types MUST match Drizzle declarations exactly.
//
// Migration 006b creates:
//   id               SERIAL PRIMARY KEY
//   consultation_id  INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE
//   clinic_id        TEXT (nullable — no FK to clinics table)
//   filename         VARCHAR(255) NOT NULL
//   mime_type        VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream'
//   size_bytes       INTEGER NOT NULL DEFAULT 0
//   data_base64      TEXT (made nullable by 008)
//   uploaded_by      VARCHAR(255)
//
// Migration 008 adds:
//   file_url         TEXT
//   file_name        TEXT
//   file_size        INTEGER
//
// Previous Drizzle schema used uuid("consultation_id") referencing
// consultationsTable.id (serial/integer) — invalid FK: uuid ≠ integer.
// drizzle-kit push would fail. Fixed to integer("consultation_id").
// ──────────────────────────────────────────────────────────────────────────────

export const consultationAttachmentsTable = pgTable("consultation_attachments", {
  // Primary key: SERIAL (integer) — matches 006b: id SERIAL PRIMARY KEY
  id: serial("id").primaryKey(),

  // FK → consultations(id): INTEGER — consultationsTable.id is serial/integer
  // FIX: was uuid("consultation_id") — invalid FK cross-type (uuid ≠ integer)
  consultationId: integer("consultation_id")
    .notNull()
    .references(() => consultationsTable.id, { onDelete: "cascade" }),

  // Multi-tenant isolation — TEXT nullable (006b has no NOT NULL constraint, no FK to clinics)
  // Enforcement at application layer via requireClinicId middleware (fail-closed 403)
  clinicId: text("clinic_id"),

  // ── Legacy columns from 006b — kept for backward compat ───────────────────
  filename: varchar("filename", { length: 255 }),
  sizeBytes: integer("size_bytes"),
  uploadedBy: varchar("uploaded_by", { length: 255 }),

  // ── Target-architecture columns added by 008 ──────────────────────────────
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),

  // Base64 payload — nullable after 008 for progressive migration to fileUrl
  dataBase64: text("data_base64"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConsultationAttachment = typeof consultationAttachmentsTable.$inferSelect;
export type NewConsultationAttachment = typeof consultationAttachmentsTable.$inferInsert;
