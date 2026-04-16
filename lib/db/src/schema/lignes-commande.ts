import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { commandesCentravetTable } from "./commandes-centravet";
import { stockMedicamentsTable } from "./stock-medicaments";

export const STATUTS_LIGNE = [
  "en_attente", "recue_complete", "recue_partielle", "manquante", "rupture_centravet",
] as const;

export const lignesCommandeTable = pgTable("lignes_commande", {
  id: serial("id").primaryKey(),
  commandeId: integer("commande_id").notNull().references(() => commandesCentravetTable.id),
  medicamentId: integer("medicament_id").notNull().references(() => stockMedicamentsTable.id),
  quantiteCommandee: real("quantite_commandee").notNull(),
  quantiteRecue: real("quantite_recue").default(0),
  prixUnitaireHT: real("prix_unitaire_ht"),
  referenceCentravet: text("reference_centravet"),
  statutLigne: text("statut_ligne").notNull().default("en_attente"),
  lotNumero: text("lot_numero"),
  datePeremptionRecu: text("date_peremption_recu"),
  ecartNotes: text("ecart_notes"),
}, (table) => ({
  commandeIdIdx: index("idx_lignes_commande_commande_id").on(table.commandeId),
  medicamentIdIdx: index("idx_lignes_commande_medicament_id").on(table.medicamentId),
}));

export const insertLigneCommandeSchema = createInsertSchema(lignesCommandeTable).omit({ id: true });
export type InsertLigneCommande = z.infer<typeof insertLigneCommandeSchema>;
export type LigneCommande = typeof lignesCommandeTable.$inferSelect;
