import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ownersTable } from "./owners";

export const portailTokensTable = pgTable("portail_tokens", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull().default("default"),
  ownerId: integer("owner_id").notNull().references(() => ownersTable.id),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdIdx: index("idx_clinic_id__portail_tokens").on(table.clinicId),
  ownerIdIdx: index("idx_portail_tokens_owner_id").on(table.ownerId),
  tokenIdx: index("idx_portail_tokens_token").on(table.token),
}));

export const insertPortailTokenSchema = createInsertSchema(portailTokensTable).omit({ id: true, createdAt: true });
export type InsertPortailToken = z.infer<typeof insertPortailTokenSchema>;
export type PortailToken = typeof portailTokensTable.$inferSelect;
