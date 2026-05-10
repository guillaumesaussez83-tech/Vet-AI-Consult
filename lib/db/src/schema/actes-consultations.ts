// lib/db/src/schema/actes-consultations.ts
// Sprint e-invoicing — Champs Factur-X EN16931 / BASIC ajoutés (BG-25 Invoice Lines)

import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { actesTable } from "./actes";
import { consultationsTable } from "./consultations";

export const actesConsultationsTable = pgTable(
  "actes_consultations",
  {
    id: serial("id").primaryKey(),
    clinicId: text("clinic_id").notNull().default("default"),
    acteId: integer("acte_id").references(() => actesTable.id),
    consultationId: integer("consultation_id")
      .notNull()
      .references(() => consultationsTable.id),

    // ── Quantité et prix ──────────────────────────────────────────────────────
    quantite: integer("quantite").notNull().default(1),   // BT-129
    prixUnitaire: real("prix_unitaire").notNull(),         // BT-146 prix HT unitaire
    tvaRate: real("tva_rate").notNull().default(20),       // BT-152 taux TVA en %
    description: text("description"),                      // BT-153 désignation ligne

    // ── Factur-X BG-25 Invoice Line ───────────────────────────────────────────
    codeArticle: text("code_article"),
    // BT-155 référence article (code acte interne ou GTIN)

    uniteMesureCode: text("unite_mesure_code").default("PCE"),
    // BT-130 UN/CEFACT: PCE=pièce, H87=unité commerciale, KGM=kg, LTR=litre, MIN=minute

    dateRealisation: text("date_realisation"),
    // BT-134 date de la prestation (si différente de la date facture)

    codeTva: text("code_tva").default("S"),
    // BT-151 catégorie TVA: S=standard (20%), AA=réduit (5.5/10%), E=exonéré, Z=taux 0

    montantLigneHt: real("montant_ligne_ht"),
    // BT-131 = quantite × prixUnitaire (calculé, dénormalisé pour performance)
    // ──────────────────────────────────────────────────────────────────────────

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clinicIdIdx: index("idx_clinic_id__actes_consultations").on(table.clinicId),
    consultationIdIdx: index("idx_actes_consultations_consultation_id").on(
      table.consultationId
    ),
    acteIdIdx: index("idx_actes_consultations_acte_id").on(table.acteId),
  })
);

export const insertActeConsultationSchema = createInsertSchema(
  actesConsultationsTable
).omit({ id: true, createdAt: true });
export type InsertActeConsultation = z.infer<typeof insertActeConsultationSchema>;
export type ActeConsultation = typeof actesConsultationsTable.$inferSelect;
