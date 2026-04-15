import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";

export const anesthesieProtocolesTable = pgTable("anesthesie_protocoles", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").notNull().unique().references(() => consultationsTable.id),
  poids: real("poids"),
  premedication: text("premedication"),
  premedicationDose: text("premedication_dose"),
  premedicationVoie: text("premedication_voie"),
  induction: text("induction"),
  inductionDose: text("induction_dose"),
  maintenance: text("maintenance"),
  maintenancePourcentage: real("maintenance_pourcentage"),
  monitoring: text("monitoring"),
  heureReveil: text("heure_reveil"),
  scoreReveil: integer("score_reveil"),
  complications: text("complications"),
  notes: text("notes"),
  protocoleIA: text("protocole_ia"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAnesthesieProtocoleSchema = createInsertSchema(anesthesieProtocolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnesthesieProtocole = z.infer<typeof insertAnesthesieProtocoleSchema>;
export type AnesthesieProtocole = typeof anesthesieProtocolesTable.$inferSelect;
