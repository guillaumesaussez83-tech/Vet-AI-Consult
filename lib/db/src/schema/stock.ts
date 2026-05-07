import { pgTable, serial, integer, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const stockItemsTable = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  name: text("name").notNull(),
  reference: text("reference"),
  category: text("category").notNull().default("MEDICAMENT"), // MEDICAMENT, CONSOMMABLE, ALIMENT, ACCESSOIRE
  unit: text("unit").notNull().default("unité"),
  currentStock: numeric("current_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  unitPriceBuy: numeric("unit_price_buy", { precision: 10, scale: 2 }).notNull().default("0"),
  unitPriceSell: numeric("unit_price_sell", { precision: 10, scale: 2 }).notNull().default("0"),
  tvaRate: numeric("tva_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  supplierId: integer("supplier_id"),
  location: text("location"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  stockItemId: integer("stock_item_id").notNull(),
  type: text("type").notNull(), // ENTREE, SORTIE, AJUSTEMENT, PEREMPTION
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  expirationDate: date("expiration_date"),
  batchNumber: text("batch_number"),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockAlertsTable = pgTable("stock_alerts", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  stockItemId: integer("stock_item_id").notNull(),
  alertType: text("alert_type").notNull(), // LOW_STOCK, EXPIRATION_SOON, OUT_OF_STOCK
  alertDate: timestamp("alert_date", { withTimezone: true }).notNull().defaultNow(),
  expirationDate: date("expiration_date"),
  batchNumber: text("batch_number"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
