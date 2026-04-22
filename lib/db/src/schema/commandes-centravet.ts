import { pgTable, text, serial, timestamp, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const STATUTS_COMMANDE = [
  "brouillon", "validee", "envoyee_centravet", "en_cours_livraison",
  "livree_partielle", "livree_complete", "annulee",
] as const;

export const TYPE_DECLENCHEMENT = ["ia_automatique", "asv_manuel", "urgence"] as const;

export const commandesCentravetTable = pgTable("commandes_centravet", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  numeroCommande: text("numero_commande").notNull(),
  statut: text("statut").notNull().default("brouillon"),
  typeDeclenchement: text("type_declenchement").notNull().default("asv_manuel"),
  dateCreation: timestamp("date_creation", { withTimezone: true }).notNull().defaultNow(),
  dateValidation: timestamp("date_validation", { withTimezone: true }),
  dateEnvoiCentravet: timestamp("date_envoi_centravet", { withTimezone: true }),
  dateLivraisonPrevue: text("date_livraison_prevue"),
  montantTotalHT: real("montant_total_ht"),
  notesIA: text("notes_ia"),
  notesASV: text("notes_asv"),
  fichierExportUrl: text("fichier_export_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__commandes_centravet").on(table.clinicId),
  statutIdx: index("idx_commandes_centravet_statut").on(table.statut),
  numeroClinicUnique: uniqueIndex("uniq_commandes_centravet_clinic_numero").on(table.clinicId, table.numeroCommande),
}));

export const insertCommandeCentravetSchema = createInsertSchema(commandesCentravetTable).omit({ id: true, createdAt: true, updatedAt: true, dateCreation: true });
export type InsertCommandeCentravet = z.infer<typeof insertCommandeCentravetSchema>;
export type CommandeCentravet = typeof commandesCentravetTable.$inferSelect;
