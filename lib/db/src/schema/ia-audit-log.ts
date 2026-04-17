import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const iaAuditLogTable = pgTable("ia_audit_log", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  consultationId: integer("consultation_id"),
  veterinaireId: integer("veterinaire_id"),
  typeAction: text("type_action"),
  promptEnvoye: text("prompt_envoye"),
  reponseIa: text("reponse_ia"),
  valideePar: text("validee_par"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  consultationIdIdx: index("idx_ia_audit_log_consultation_id").on(table.consultationId),
  typeActionIdx: index("idx_ia_audit_log_type_action").on(table.typeAction),
}));

export const insertIaAuditLogSchema = createInsertSchema(iaAuditLogTable).omit({ id: true, createdAt: true });
export type InsertIaAuditLog = z.infer<typeof insertIaAuditLogSchema>;
export type IaAuditLog = typeof iaAuditLogTable.$inferSelect;
