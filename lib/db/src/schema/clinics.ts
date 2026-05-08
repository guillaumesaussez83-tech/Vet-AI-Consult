// lib/db/src/schema/clinics.ts
// Phase 4 — Architecture multi-cliniques scalable (10+ cliniques)

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
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  siret: text("siret"),
  ordreVet: text("ordre_vet"), // N° Ordre National des Vétérinaires
  groupId: integer("group_id").references(() => clinicGroupsTable.id), // null = standalone
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
