import { pgTable, bigserial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Phase 0D — Audit Logs schema
 * Mirrors phase0d-audit-logs.sql
 */
export const auditLogs = pgTable("audit_logs", {
  id:            bigserial("id", { mode: "number" }).primaryKey(),
  clinicId:      text("clinic_id").notNull(),
  userId:        text("user_id").notNull(),
  userEmail:     text("user_email"),
  action:        text("action").notNull(),        // CREATE | UPDATE | DELETE | VIEW
  resourceType:  text("resource_type").notNull(),
  resourceId:    text("resource_id"),
  resourceLabel: text("resource_label"),
  metadata:      jsonb("metadata").default({}),
  ipAddress:     text("ip_address"),
  userAgent:     text("user_agent"),
  createdAt:     timestamp("created_at", { withTimezone: true })
                   .notNull()
                   .defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
