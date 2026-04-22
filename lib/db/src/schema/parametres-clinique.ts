import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parametresCliniqueTable = pgTable("parametres_clinique", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  nomClinique: text("nom_clinique"),
  adresse: text("adresse"),
  codePostal: text("code_postal"),
  ville: text("ville"),
  telephone: text("telephone"),
  email: text("email"),
  siteWeb: text("site_web"),
  siret: text("siret"),
  numeroOrdre: text("numero_ordre"),
  numTVA: text("num_tva"),
  logoUrl: text("logo_url"),
  horaires: text("horaires"),
  mentionsLegales: text("mentions_legales"),
  rgpdResponsableNom: text("rgpd_responsable_nom"),
  rgpdAdresseExercice: text("rgpd_adresse_exercice"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertParametresCliniqueSchema = createInsertSchema(parametresCliniqueTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertParametresClinique = z.infer<typeof insertParametresCliniqueSchema>;
export type ParametresClinique = typeof parametresCliniqueTable.$inferSelect;
