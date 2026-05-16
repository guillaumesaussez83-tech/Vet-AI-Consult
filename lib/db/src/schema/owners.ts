// lib/db/src/schema/owners.ts
// Sprint e-invoicing — Champs Factur-X EN16931 / BASIC ajoutés (BG-7 Buyer)

import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ownersTable = pgTable("owners", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),

  // Identité
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email"),
  telephone: text("telephone").notNull(),
  adresse: text("adresse"),

  // ── Facturation électronique — BG-7 Buyer ─────────────────────────────────
  // Type client : détermine la logique de facturation B2C vs B2B
  typeClient: text("type_client").default("particulier"),
  // CHECK: 'particulier' | 'entreprise'

  // Champs B2B (nullable — uniquement si typeClient = 'entreprise')
  raisonSociale: text("raison_sociale"),          // BT-44 Buyer name (B2B)
  siren: text("siren"),                           // SIREN 9 chiffres — BT-46
  siret: text("siret"),                           // SIRET 14 chiffres — BT-46
  tvaIntra: text("tva_intra"),                    // TVA intracommunautaire — BT-48
  codeServiceExecutant: text("code_service_executant"), // Pour B2G (admin publique) — BT-49

  // Localisation
  paysIso2: text("pays_iso2").default("FR"),      // ISO 3166-1 alpha-2 — BT-55
  codePostal: text("code_postal"),           // BT-53 PostcodeCode acheteur
  ville: text("ville"),                      // BT-52 CityName acheteur
  // ──────────────────────────────────────────────────────────────────────────

  // RGPD
  rgpdAccepted: boolean("rgpd_accepted").notNull().default(false),
  rgpdAcceptedAt: timestamp("rgpd_accepted_at", { withTimezone: true }),
  rgpdDocumentUrl: text("rgpd_document_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOwnerSchema = createInsertSchema(ownersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof ownersTable.$inferSelect;
