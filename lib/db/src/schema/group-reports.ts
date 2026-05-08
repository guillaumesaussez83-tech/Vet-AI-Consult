// lib/db/src/schema/group-reports.ts
// Phase 4 — Rapports PDF mensuels par clinique

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "generating",
  "ready",
  "error",
]);

export const groupReportsTable = pgTable("group_reports", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),

  reportType: text("report_type").notNull().default("monthly"), // monthly | quarterly
  periodLabel: text("period_label").notNull(), // e.g. "Avril 2026"
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(), // YYYY-MM-DD

  status: reportStatusEnum("status").notNull().default("pending"),

  // KPI snapshot stored in JSONB for display without recomputing
  kpiSummary: jsonb("kpi_summary"),

  // PDF stored as base64 in DB (avoids external storage dependency)
  pdfData: text("pdf_data"), // base64 string
  pdfSizeBytes: integer("pdf_size_bytes"),

  generatedBy: text("generated_by").notNull(), // Clerk userId
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
