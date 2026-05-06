import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const aiOutputsTable = pgTable(
  "ai_outputs",
  {
    id: serial("id").primaryKey(),
    consultationId: integer("consultation_id").notNull(),
    pipelineType: text("pipeline_type").notNull(), // 'anamnese' | 'examen' | 'synthese'
    rawOutput: text("raw_output").notNull(),
    parsedOutput: jsonb("parsed_output"),
    wasValidated: boolean("was_validated").notNull().default(false),
    validatedBy: text("validated_by"), // Clerk user ID
    validationChanges: jsonb("validation_changes"),
    clinicId: text("clinic_id").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    consultationIdx: index("ai_outputs_consultation_idx").on(table.consultationId),
    clinicIdx: index("ai_outputs_clinic_idx").on(table.clinicId),
    pipelineTypeIdx: index("ai_outputs_pipeline_type_idx").on(table.pipelineType),
    validatedIdx: index("ai_outputs_validated_idx").on(table.wasValidated),
  })
);

export type AiOutput = typeof aiOutputsTable.$inferSelect;
export type NewAiOutput = typeof aiOutputsTable.$inferInsert;
