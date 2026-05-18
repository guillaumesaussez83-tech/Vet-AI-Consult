// lib/db/src/schema/encaissements.ts
// Encaissements (paiements reçus) — table de suivi des règlements

import { pgTable, serial, text, real, timestamp, index } from "drizzle-orm/pg-core";

export const encaissementsTable = pgTable(
  "encaissements",
  {
    id: serial("id").primaryKey(),
    clinicId: text("clinic_id").notNull().default("default"),
    factureId: text("facture_id"),
    montantPaye: real("montant_paye").notNull().default(0),
    modePaiement: text("mode_paiement"),
    reference: text("reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clinicIdIdx: index("idx_encaissements_clinic_id").on(table.clinicId),
    createdAtIdx: index("idx_encaissements_created_at").on(table.createdAt),
  })
);

export type Encaissement = typeof encaissementsTable.$inferSelect;
export type InsertEncaissement = typeof encaissementsTable.$inferInsert;
