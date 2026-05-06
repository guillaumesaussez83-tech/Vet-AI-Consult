import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const cremationPartnersTable = pgTable("cremation_partners", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  nom: text("nom").notNull(),
  adresse: text("adresse"),
  telephone: text("telephone"),
  email: text("email"),
  tarifIndividuel: numeric("tarif_individuel", { precision: 10, scale: 2 }),
  tarifCollectif: numeric("tarif_collectif", { precision: 10, scale: 2 }),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const createCremationPartnerSchema = createInsertSchema(cremationPartnersTable).omit({ id: true, createdAt: true, updatedAt: true });
