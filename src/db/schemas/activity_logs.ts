import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { admins } from "./admins.ts";

export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: int("id").primaryKey().autoincrement(),
    adminId: int("admin_id").references(() => admins.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    description: text("description").notNull(),
    metadata: text("metadata"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("log_admin_id_idx").on(table.adminId),
    index("log_action_idx").on(table.action),
    index("log_created_at_idx").on(table.createdAt),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
