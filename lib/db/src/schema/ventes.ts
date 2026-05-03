import { pgTable, text, serial, timestamp, integer, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assistantsTable } from "./assistants";
import { patientsTable } from "./patients";
import { ownersTable } from "./owners";
import { ordonnancesTable } from "./ordonnances";

export const ventesTable = pgTable("ventes", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  numero: text("numero").notNull(),
  type: text("type").notNull().default("comptoir"), // 'comptoir' | 'prescription'
  assistantId: integer("assistant_id").references(() => assistantsTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  proprietaireId: integer("proprietaire_id").references(() => ownersTable.id),
  ordonnanceId: integer("ordonnance_id").references(() => ordonnancesTable.id),
  notes: text("notes"),
  modePaiement: text("mode_paiement").notNull().default("especes"), // 'especes' | 'cb' | 'cheque' | 'virement'
  montantHt: numeric("montant_ht", { precision: 10, scale: 2 }).default("0"),
  montantTva: numeric("montant_tva", { precision: 10, scale: 2 }).default("0"),
  montantTtc: numeric("montant_ttc", { precision: 10, scale: 2 }).default("0"),
  statut: text("statut").default("completee"),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__ventes").on(table.clinicId),
  assistantIdIdx: index("idx_ventes_assistant_id").on(table.assistantId),
  typeIdx: index("idx_ventes_type").on(table.type),
  uniqClinicNumero: uniqueIndex("uniq_ventes_clinic_numero").on(table.clinicId, table.numero),
}));

export const venteLignesTable = pgTable("vente_lignes", {
  id: serial("id").primaryKey(),
  venteId: integer("vente_id").notNull().references(() => ventesTable.id, { onDelete: "cascade" }),
  produitId: integer("produit_id"),
  description: text("description").notNull(),
  quantite: numeric("quantite", { precision: 10, scale: 3 }).default("1"),
  prixUnitaire: numeric("prix_unitaire", { precision: 10, scale: 2 }).notNull(),
  tvaTaux: numeric("tva_taux", { precision: 5, scale: 2 }).default("20"),
  montantHt: numeric("montant_ht", { precision: 10, scale: 2 }).notNull(),
  montantTtc: numeric("montant_ttc", { precision: 10, scale: 2 }).notNull(),
}, (table) => ({
  venteIdIdx: index("idx_vente_lignes_vente_id").on(table.venteId),
}));

export const insertVenteSchema = createInsertSchema(ventesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVente = z.infer<typeof insertVenteSchema>;
export type Vente = typeof ventesTable.$inferSelect;

export const insertVenteLigneSchema = createInsertSchema(venteLignesTable).omit({ id: true });
export type InsertVenteLigne = z.infer<typeof insertVenteLigneSchema>;
export type VenteLigne = typeof venteLignesTable.$inferSelect;
