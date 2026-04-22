import { pgTable, serial, text, real, integer, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMedicamentsTable } from "./stock-medicaments";
import { patientsTable } from "./patients";

export const registreStupefiantsTable = pgTable("registre_stupefiants", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  stockMedicamentId: integer("stock_medicament_id").notNull().references(() => stockMedicamentsTable.id),
  dateMouvement: timestamp("date_mouvement", { withTimezone: true }).notNull().defaultNow(),
  typeMouvement: text("type_mouvement").notNull(),
  quantite: real("quantite").notNull(),
  unite: text("unite").notNull().default("ml"),
  numeroLot: text("numero_lot"),
  dateExpirationLot: date("date_expiration_lot"),
  animalId: integer("animal_id").references(() => patientsTable.id),
  veterinaire: text("veterinaire").notNull(),
  motif: text("motif"),
  soldeApres: real("solde_apres").notNull(),
  ordonnanceId: integer("ordonnance_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__registre_stupefiants").on(table.clinicId),
  medicamentIdx: index("idx_registre_stupefiants_medicament").on(table.stockMedicamentId),
  dateIdx: index("idx_registre_stupefiants_date").on(table.dateMouvement),
  typeIdx: index("idx_registre_stupefiants_type").on(table.typeMouvement),
}));

export const insertRegistreStupefiantSchema = createInsertSchema(registreStupefiantsTable).omit({ id: true, createdAt: true });
export type InsertRegistreStupefiant = z.infer<typeof insertRegistreStupefiantSchema>;
export type RegistreStupefiant = typeof registreStupefiantsTable.$inferSelect;
