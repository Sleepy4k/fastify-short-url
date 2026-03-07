import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { urls } from "./urls.ts";

export const clicks = mysqlTable(
  "clicks",
  {
    id: int("id").primaryKey().autoincrement(),
    urlId: int("url_id")
      .notNull()
      .references(() => urls.id, { onDelete: "cascade" }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    referer: varchar("referer", { length: 512 }),
    clickedAt: timestamp("clicked_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("url_id_idx").on(table.urlId),
    index("clicked_at_idx").on(table.clickedAt),
  ],
);

export type Click = typeof clicks.$inferSelect;
export type NewClick = typeof clicks.$inferInsert;
