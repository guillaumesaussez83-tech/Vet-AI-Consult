import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const medicationsAnmvTable = pgTable(
  "medications_anmv",
  {
    id: serial("id").primaryKey(),
    ammNumber: text("amm_number").notNull().unique(),
    name: text("name").notNull(),
    genericName: text("generic_name"),
    speciesAuthorized: text("species_authorized").array().notNull().default([]),
    indications: text("indications").array().notNull().default([]),
    dosageCa: text("dosage_ca"),
    dosageFe: text("dosage_fe"),
    maxDurationDays: integer("max_duration_days"),
    withdrawalPeriod: text("withdrawal_period"),
    isAntibiotic: boolean("is_antibiotic").notNull().default(false),
    antibioticClass: text("antibiotic_class"),
    isControlled: boolean("is_controlled").notNull().default(false),
    contraindications: text("contraindications").array().notNull().default([]),
    interactions: text("interactions").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    speciesIdx: index("medications_anmv_species_idx").on(table.speciesAuthorized),
    antibioticIdx: index("medications_anmv_antibiotic_idx").on(table.isAntibiotic),
    nameIdx: index("medications_anmv_name_idx").on(table.name),
  })
);

export type MedicationAnmv = typeof medicationsAnmvTable.$inferSelect;
export type NewMedicationAnmv = typeof medicationsAnmvTable.$inferInsert;
