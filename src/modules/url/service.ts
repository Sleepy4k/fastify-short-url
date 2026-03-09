import { eq, desc, asc, sql, or, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import type { DB } from "../../db/connection.ts";
import type { CacheClient } from "../../plugins/redis.ts";
import { urls, clicks } from "../../db/schema.ts";
import type { FastifyRequest } from "fastify";
import type { CreateUrlDto, UpdateUrlDto } from "../../types/index.ts";

export type { CreateUrlDto, UpdateUrlDto };

const CACHE_PREFIX = "url:";
const CACHE_TTL = Number(process.env["REDIS_TTL"] ?? 3600);

const SOCIAL_BOT_UAS = [
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "googlebot",
  "googlebot-image",
  "bingbot",
  "applebot",
  "yandexbot",
  "duckduckbot",
  "pinterest",
  "vkshare",
  "w3c_validator",
  "iframely",
  "embedly",
];

export function isSocialBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return SOCIAL_BOT_UAS.some((bot) => ua.includes(bot));
}

export async function getUrlsPaginated(
  db: DB,
  page: number,
  limit: number,
  search = "",
  sort = "createdAt:desc",
) {
  const offset = (page - 1) * limit;
  const s = search.trim();
  const searchCond = s
    ? or(like(urls.shortcode, `%${s}%`), like(urls.originalUrl, `%${s}%`))
    : undefined;
  const [sf, sd] = sort.split(":");
  const orderCol =
    sf === "clicks"
      ? sd === "asc" ? asc(urls.totalClicks) : desc(urls.totalClicks)
      : sf === "shortcode"
        ? sd === "asc" ? asc(urls.shortcode) : desc(urls.shortcode)
        : sf === "expiresAt"
          ? sd === "asc" ? asc(urls.expiresAt) : desc(urls.expiresAt)
          : sd === "asc" ? asc(urls.createdAt) : desc(urls.createdAt);
  const [rows, countResult] = await Promise.all([
    db.select().from(urls).where(searchCond).orderBy(orderCol).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(urls).where(searchCond),
  ]);
  return { urls: rows, total: Number(countResult[0]?.count ?? 0), search, sort };
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
  let passwordHash: string | null = null;
  if (data.password?.trim()) {
    passwordHash = await Bun.password.hash(data.password.trim(), {
      algorithm: "argon2id",
    });
  }
  try {
    await db.insert(urls).values({
      shortcode,
      originalUrl: data.originalUrl,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
      passwordHash,
      title: data.title?.trim() || null,
      description: data.description?.trim() || null,
      ogImageUrl: data.ogImageUrl?.trim() || null,
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
  if (data.title !== undefined) update.title = data.title?.trim() || null;
  if (data.description !== undefined)
    update.description = data.description?.trim() || null;
  if (data.ogImageUrl !== undefined)
    update.ogImageUrl = data.ogImageUrl?.trim() || null;

  // Password handling
  const shouldClear =
    data.clearPassword === true || data.clearPassword === "true";
  if (shouldClear) {
    update.passwordHash = null;
  } else if (data.password?.trim()) {
    update.passwordHash = await Bun.password.hash(data.password.trim(), {
      algorithm: "argon2id",
    });
  }

  await db.update(urls).set(update).where(eq(urls.id, id));
  if (old?.shortcode) await redis.del(`${CACHE_PREFIX}${old.shortcode}`);
}

export async function toggleUrlActive(
  db: DB,
  redis: CacheClient,
  id: number,
  isActive: boolean,
): Promise<string | undefined> {
  const [row] = await db
    .select({ shortcode: urls.shortcode })
    .from(urls)
    .where(eq(urls.id, id))
    .limit(1);
  await db.update(urls).set({ isActive }).where(eq(urls.id, id));
  if (row?.shortcode) await redis.del(`${CACHE_PREFIX}${row.shortcode}`);
  return row?.shortcode;
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
  skipCache = false,
) {
  type Url = typeof urls.$inferSelect;
  type Result =
    | { status: "active"; url: string; urlData: Url | null }
    | { status: "expired"; url: ""; urlData: null }
    | { status: "notfound"; url: ""; urlData: null }
    | { status: "inactive"; url: ""; urlData: null }
    | { status: "password_required"; url: ""; urlData: Url };

  if (!skipCache) {
    const cached = await redis.get(`${CACHE_PREFIX}${code}`);
    if (cached)
      return { status: "active", url: cached, urlData: null } as Result;
  }

  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.shortcode, code))
    .limit(1);

  if (!row || !row.isActive) {
    const status = row ? ("inactive" as const) : ("notfound" as const);
    return { status, url: "", urlData: null } as Result;
  }
  if (row.expiresAt && row.expiresAt < new Date())
    return { status: "expired", url: "", urlData: null } as Result;

  // Password-protected URLs are NOT cached
  if (row.passwordHash) {
    return { status: "password_required", url: "", urlData: row } as Result;
  }

  await redis.setex(`${CACHE_PREFIX}${code}`, CACHE_TTL, row.originalUrl);
  return { status: "active", url: row.originalUrl, urlData: row } as Result;
}

export async function verifyUrlPassword(
  passwordHash: string,
  submitted: string,
): Promise<boolean> {
  return Bun.password.verify(submitted, passwordHash);
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
    const userAgent =
      ((req.headers["user-agent"] as string) || "").substring(0, 512) || null;
    const referer =
      ((req.headers["referer"] as string) || "").substring(0, 512) || null;

    await Promise.all([
      db.insert(clicks).values({ urlId: row.id, ipAddress: rawIp || null, userAgent, referer }),
      db
        .update(urls)
        .set({ totalClicks: sql`total_clicks + 1` })
        .where(eq(urls.id, row.id)),
    ]);
  } catch {
    // Silently ignore
  }
}
