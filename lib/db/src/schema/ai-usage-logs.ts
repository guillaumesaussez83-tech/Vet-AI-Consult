import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiUsageLogsTable = pgTable("ai_usage_logs", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  consultationId: integer("consultation_id"),
  taskType: text("task_type").notNull(),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_ai_usage_logs_clinic_id").on(table.clinicId),
  taskTypeIdx: index("idx_ai_usage_logs_task_type").on(table.taskType),
  createdAtIdx: index("idx_ai_usage_logs_created_at").on(table.createdAt),
}));

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogsTable.$inferSelect;
