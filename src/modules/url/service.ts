import { eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { createHash } from "crypto";
import type { DB } from "../../db/connection.ts";
import type { CacheClient } from "../../plugins/redis.ts";
import { urls, clicks } from "../../db/schema.ts";
import type { FastifyRequest } from "fastify";
import type { CreateUrlDto, UpdateUrlDto } from "../../types/index.ts";

export type { CreateUrlDto, UpdateUrlDto };

const CACHE_PREFIX = "url:";
const CACHE_TTL = Number(process.env["REDIS_TTL"] ?? 3600);

export async function getUrlsPaginated(db: DB, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(urls)
      .orderBy(desc(urls.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(urls),
  ]);
  return { urls: rows, total: Number(countResult[0]?.count ?? 0) };
}

export async function getUrlById(db: DB, id: number) {
  const [row] = await db.select().from(urls).where(eq(urls.id, id)).limit(1);
  return row ?? null;
}

export async function createUrl(db: DB, data: CreateUrlDto): Promise<string> {
  if (data.customAlias && !/^[a-zA-Z0-9_-]+$/.test(data.customAlias)) {
    const err = new Error(
      "Alias hanya boleh mengandung huruf, angka, tanda hubung (-) dan garis bawah (_).",
    );
    (err as { code?: string }).code = "INVALID_ALIAS";
    throw err;
  }
  const shortcode = data.customAlias?.trim() || nanoid(7);
  try {
    await db.insert(urls).values({
      shortcode,
      originalUrl: data.originalUrl,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
    });
  } catch (err: unknown) {
    const isDup =
      err instanceof Error && err.message.includes("Duplicate entry");
    if (isDup) {
      const e = new Error(
        "Alias tersebut sudah digunakan oleh shortlink lain. Pilih alias yang berbeda.",
      );
      (e as { code?: string }).code = "DUPLICATE_ALIAS";
      throw e;
    }
    throw err;
  }
  return shortcode;
}

export async function updateUrl(
  db: DB,
  redis: CacheClient,
  id: number,
  data: UpdateUrlDto,
) {
  if (data.shortcode !== undefined) {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.shortcode)) {
      const e = new Error(
        "Shortcode hanya boleh mengandung huruf, angka, tanda hubung (-) dan garis bawah (_).",
      );
      (e as { code?: string }).code = "INVALID_SHORTCODE";
      throw e;
    }
    const [existing] = await db
      .select()
      .from(urls)
      .where(eq(urls.shortcode, data.shortcode))
      .limit(1);
    if (existing && existing.id !== id) {
      const e = new Error(
        "Shortcode tersebut sudah digunakan. Silakan pilih shortcode lain.",
      );
      (e as { code?: string }).code = "SHORTCODE_TAKEN";
      throw e;
    }
  }

  const [old] = await db
    .select({ shortcode: urls.shortcode })
    .from(urls)
    .where(eq(urls.id, id))
    .limit(1);

  const update: Partial<typeof urls.$inferInsert> = {};
  if (data.originalUrl !== undefined) update.originalUrl = data.originalUrl;
  if (data.shortcode !== undefined) update.shortcode = data.shortcode;
  if (data.isActive !== undefined)
    update.isActive = data.isActive === true || data.isActive === "true";
  if (data.expiresAt !== undefined)
    update.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  await db.update(urls).set(update).where(eq(urls.id, id));
  if (old?.shortcode) await redis.del(`${CACHE_PREFIX}${old.shortcode}`);
}

export async function deleteUrl(
  db: DB,
  redis: CacheClient,
  id: number,
): Promise<string | undefined> {
  const [row] = await db
    .select({ shortcode: urls.shortcode })
    .from(urls)
    .where(eq(urls.id, id))
    .limit(1);
  await db.delete(urls).where(eq(urls.id, id));
  if (row?.shortcode) await redis.del(`${CACHE_PREFIX}${row.shortcode}`);
  return row?.shortcode;
}

export async function generateQrCode(shortUrl: string): Promise<string> {
  return QRCode.toDataURL(shortUrl, { width: 300, margin: 2 });
}

export async function resolveRedirect(
  db: DB,
  redis: CacheClient,
  code: string,
) {
  const cached = await redis.get(`${CACHE_PREFIX}${code}`);
  if (cached) return { url: cached, status: "active" as const };

  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortcode, code))
    .limit(1);
  if (!row || !row.isActive) {
    const status = row ? ("inactive" as const) : ("notfound" as const);
    return { url: "", status };
  }
  if (row.expiresAt && row.expiresAt < new Date())
    return { url: "", status: "expired" as const };

  await redis.setex(`${CACHE_PREFIX}${code}`, CACHE_TTL, row.originalUrl);
  return { url: row.originalUrl, status: "active" as const };
}

export async function recordClick(
  db: DB,
  code: string,
  req: FastifyRequest,
): Promise<void> {
  try {
    const [row] = await db
      .select({ id: urls.id })
      .from(urls)
      .where(eq(urls.shortcode, code))
      .limit(1);
    if (!row) return;

    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "";
    const ipHash = rawIp
      ? createHash("sha256").update(rawIp).digest("hex")
      : null;
    const userAgent =
      ((req.headers["user-agent"] as string) || "").substring(0, 512) || null;
    const referer =
      ((req.headers["referer"] as string) || "").substring(0, 512) || null;

    await Promise.all([
      db.insert(clicks).values({ urlId: row.id, ipHash, userAgent, referer }),
      db
        .update(urls)
        .set({ totalClicks: sql`total_clicks + 1` })
        .where(eq(urls.id, row.id)),
    ]);
  } catch {
    // Silently ignore
  }
}
