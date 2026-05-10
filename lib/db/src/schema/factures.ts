// lib/db/src/schema/factures.ts
// Sprint e-invoicing — Champs Factur-X EN16931 / BASIC ajoutés (BG-2 Invoice)

import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";

export const facturesTable = pgTable(
  "factures",
  {
    id: serial("id").primaryKey(),
    clinicId: text("clinic_id").notNull().default("default"),
    consultationId: integer("consultation_id")
      .notNull()
      .references(() => consultationsTable.id)
      .unique(),

    // ── Identification — BT-1, BT-2, BT-3 ──────────────────────────────────
    numero: text("numero").notNull(),                    // BT-1 unique par clinique
    dateEmission: text("date_emission").notNull(),       // BT-2
    codeTypeDocument: text("code_type_document").default("380"),
    // BT-3: 380=facture, 381=avoir, 384=rectificative, 386=acompte

    // ── Montants ─────────────────────────────────────────────────────────────
    montantHT: real("montant_ht").notNull(),             // BT-109
    tva: real("tva").notNull().default(20),
    tvaBreakdown: jsonb("tva_breakdown"),                // Ventilation par taux
    montantTTC: real("montant_ttc").notNull(),           // BT-112

    // ── Paiement ──────────────────────────────────────────────────────────────
    statut: text("statut").notNull().default("en_attente"),
    dateEcheance: text("date_echeance"),                 // BT-9
    modePaiement: text("mode_paiement"),                 // Texte libre (legacy)
    modePaiementCode: text("mode_paiement_code"),
    // BT-81 UN/CEFACT: 10=espèces, 30=virement, 48=CB, 49=SEPA, 97=chèque
    datePaiement: text("date_paiement"),
    montantEspecesRecu: real("montant_especes_recu"),

    // ── Références ────────────────────────────────────────────────────────────
    referenceAcheteur: text("reference_acheteur"),       // BT-10 N° bon de commande client
    referenceFacturePrecedente: text("reference_facture_precedente"),
    // BT-25 pour avoirs et rectificatives

    // ── Informations complémentaires ──────────────────────────────────────────
    noteFacture: text("note_facture"),                   // BT-22 note libre
    currencyIso: text("currency_iso").default("EUR"),    // BT-5 ISO 4217
    mentionLoi: text("mention_loi"),
    // Mention légale Art. L441-6 C.com (délais paiement + pénalités)

    // ── Workflow e-invoicing (préparation PDP) ─────────────────────────────────
    statutEinvoice: text("statut_einvoice").default("draft"),
    // draft | to_be_sent | sent | received | accepted | refused | paid

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    clinicIdIdx: index("idx_clinic_id__factures").on(table.clinicId),
    consultationIdIdx: index("idx_factures_consultation_id").on(
      table.consultationId
    ),
    statutIdx: index("idx_factures_statut").on(table.statut),
    dateEmissionIdx: index("idx_factures_date_emission").on(table.dateEmission),
    numeroClinicUnique: uniqueIndex("uniq_factures_clinic_numero").on(
      table.clinicId,
      table.numero
    ),
    statutEinvoiceIdx: index("idx_factures_statut_einvoice").on(
      table.statutEinvoice
    ),
  })
);

export const insertFactureSchema = createInsertSchema(facturesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFacture = z.infer<typeof insertFactureSchema>;
export type Facture = typeof facturesTable.$inferSelect;
