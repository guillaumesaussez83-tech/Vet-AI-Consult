import { pgTable, serial, integer, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const fournisseursTable = pgTable("fournisseurs", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  name: text("name").notNull(),
  contact: text("contact"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  siret: text("siret"),
  paymentConditions: text("payment_conditions"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commandesFournisseursTable = pgTable("commandes_fournisseurs", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  fournisseurId: integer("fournisseur_id").notNull(),
  orderNumber: text("order_number").notNull(),
  status: text("status").notNull().default("BROUILLON"), // BROUILLON, ENVOYEE, RECUE, ANNULEE
  orderDate: date("order_date").notNull(),
  expectedDate: date("expected_date"),
  totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull().default("0"),
  totalTva: numeric("total_tva", { precision: 10, scale: 2 }).notNull().default("0"),
  totalTtc: numeric("total_ttc", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commandeLignesTable = pgTable("commande_lignes", {
  id: serial("id").primaryKey(),
  commandeId: integer("commande_id").notNull(),
  stockItemId: integer("stock_item_id"),
  designation: text("designation").notNull(),
  reference: text("reference"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  tvaRate: numeric("tva_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  totalHt: numeric("total_ht", { precision: 10, scale: 2 }).notNull(),
});
