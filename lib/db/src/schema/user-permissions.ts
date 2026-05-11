import { pgTable, uuid, varchar, boolean, timestamp, text, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";

export const userPermissions = pgTable("user_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  clinicId: text("clinic_id").notNull().references(() => clinicsTable.id),
  module: varchar("module", { length: 50 }).notNull(),
  canRead: boolean("can_read").notNull().default(true),
  canWrite: boolean("can_write").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clinicIdx: index("user_perms_clinic_idx").on(table.clinicId),
  userClinicIdx: index("user_perms_user_clinic_idx").on(table.userId, table.clinicId),
}));
