// lib/db/src/schema/clinics.ts
// Phase 4 — Architecture multi-cliniques scalable (10+ cliniques)
// Sprint e-invoicing — Champs Factur-X EN16931 / BASIC ajoutés

import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// Table principale des cliniques (1 ligne par clinique)
// clinicId dans les autres tables = clinicsTable.id
export const clinicsTable = pgTable("clinics", {
  id: text("id").primaryKey(), // = Clerk organizationId ou UUID court
  name: text("name").notNull(),

  // Adresse (champs séparés pour Factur-X BT-35..BT-40)
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  paysIso2: text("pays_iso2").default("FR"), // BT-40, ISO 3166-1 alpha-2

  // Contact
  phone: text("phone"),
  email: text("email"),

  // Identifiants légaux — BG-4 Seller
  siret: text("siret"),                          // 14 chiffres — BT-30
  siren: text("siren"),                          // 9 chiffres (3 premiers chiffres SIRET)
  tvaIntra: text("tva_intra"),                   // FR + 11 chiffres — BT-31
  rcsVille: text("rcs_ville"),                   // Ex: "Paris"
  rcsNumero: text("rcs_numero"),                 // Ex: "RCS Paris 123 456 789"
  formeJuridique: text("forme_juridique"),        // SELARL | SARL | SCP | EURL | SASU | SAS | EARL
  codeNaf: text("code_naf").default("8520Z"),    // Code APE, défaut activités vétérinaires

  // Coordonnées bancaires — BT-84 (modalités paiement Factur-X)
  iban: text("iban"),
  bic: text("bic"),
  nomCompteBancaire: text("nom_compte_bancaire"),

  // Spécifique vétérinaire
  ordreVet: text("ordre_vet"),                   // N° Ordre National des Vétérinaires

  // Multi-cliniques
  groupId: integer("group_id").references(() => clinicGroupsTable.id),
  plan: text("plan").notNull().default("starter"), // starter | pro | enterprise
  maxUsers: integer("max_users").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  logoUrl: text("logo_url"),
  timezone: text("timezone").notNull().default("Europe/Paris"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Groupes de cliniques (multi-sites)
export const clinicGroupsTable = pgTable("clinic_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(), // Clerk userId du directeur groupe
  description: text("description"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Mapping utilisateurs <-> cliniques avec rôle spécifique par clinique
export const clinicUsersTable = pgTable("clinic_users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Clerk userId
  clinicId: text("clinic_id")
    .notNull()
    .references(() => clinicsTable.id),
  role: text("role").notNull().default("VETERINAIRE"),
  // VETERINAIRE | ASSISTANT | DIRECTION_CLINIQUE | DIRECTION_GROUPE | ADMIN
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
