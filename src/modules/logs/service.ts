import { eq, desc, asc, sql, or, like } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { activityLogs, admins } from "../../db/schema.ts";

export interface LogActivityOpts {
  adminId?: number | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logActivity(
  db: DB,
  opts: LogActivityOpts,
): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      adminId: opts.adminId ?? null,
      action: opts.action,
      description: opts.description,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      ipAddress: opts.ipAddress ?? null,
    });
  } catch {
    // Silently ignore — logging must never break the main flow
  }
}

export async function getLogs(
  db: DB,
  page: number,
  limit: number,
  search: string,
  sort: "asc" | "desc",
) {
  const offset = (page - 1) * limit;
  const searchCondition = search.trim()
    ? or(
        like(activityLogs.description, `%${search.trim()}%`),
        like(activityLogs.action, `%${search.trim()}%`),
        like(admins.username, `%${search.trim()}%`),
      )
    : undefined;

  const orderCol =
    sort === "asc" ? asc(activityLogs.createdAt) : desc(activityLogs.createdAt);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        adminId: activityLogs.adminId,
        action: activityLogs.action,
        description: activityLogs.description,
        metadata: activityLogs.metadata,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
        username: admins.username,
      })
      .from(activityLogs)
      .leftJoin(admins, eq(activityLogs.adminId, admins.id))
      .where(searchCondition)
      .orderBy(orderCol)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .leftJoin(admins, eq(activityLogs.adminId, admins.id))
      .where(searchCondition),
  ]);

  return {
    logs: rows,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
    search,
    sort,
  };
}
