import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as svc from "./service.ts";
import { logActivity } from "../logs/service.ts";
import { urls as urlsTable } from "../../db/schema.ts";

function getIp(req: FastifyRequest): string {
  return (
    ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip) || ""
  );
}

export async function handleRedirect(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { code: string } }>,
  reply: FastifyReply,
) {
  const { code } = req.params;
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const isBot = svc.isSocialBot(ua);

  const result = await svc.resolveRedirect(
    app.db,
    app.redis,
    code,
    isBot,
  );

  if (result.status === "active") {
    setImmediate(() => void svc.recordClick(app.db, code, req));

    const urlData = result.urlData;
    if (
      isBot &&
      urlData &&
      (urlData.title || urlData.description || urlData.ogImageUrl)
    ) {
      return reply.view("pages/url/preview.ejs", {
        url: urlData,
        targetUrl: result.url,
        shortUrl: `${app.config.BASE_URL}/${code}`,
        layout: false,
      });
    }

    return reply
      .status(301)
      .header("Cache-Control", "public, max-age=3600")
      .header("ETag", code)
      .redirect(result.url);
  }

  if (result.status === "password_required") {
    return reply.view("pages/url/password.ejs", {
      code,
      error: null,
      url: result.urlData,
      baseUrl: app.config.BASE_URL,
      layout: false,
    });
  }

  if (result.status === "expired") {
    return reply.status(410).view("errors/expired.ejs", { layout: false });
  }
  return reply.status(404).view("errors/404.ejs", { layout: false });
}

export async function handlePasswordRedirect(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { code: string }; Body: { password: string } }>,
  reply: FastifyReply,
) {
  const { code } = req.params;
  const { password } = req.body;

  const [row] = await app.db
    .select()
    .from(urlsTable)
    .where(eq(urlsTable.shortcode, code))
    .limit(1);

  if (!row || !row.isActive) {
    return reply.status(404).view("errors/404.ejs", { layout: false });
  }
  if (row.expiresAt && row.expiresAt < new Date()) {
    return reply.status(410).view("errors/expired.ejs", { layout: false });
  }
  if (!row.passwordHash) {
    setImmediate(() => void svc.recordClick(app.db, code, req));
    return reply.status(302).redirect(row.originalUrl);
  }

  const valid = await svc.verifyUrlPassword(row.passwordHash, password ?? "");
  if (!valid) {
    return reply.view("pages/url/password.ejs", {
      code,
      error: "Password salah. Silakan coba lagi.",
      url: row,
      baseUrl: app.config.BASE_URL,
      layout: false,
    });
  }

  setImmediate(() => void svc.recordClick(app.db, code, req));
  return reply.status(302).redirect(row.originalUrl);
}

export async function listUrls(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const q = req.query as { page?: string; limit?: string; search?: string; sort?: string };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 10)));
  const search = (q.search ?? "").trim();
  const sort = q.sort ?? "createdAt:desc";

  if (!req.headers["hx-request"]) {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (search) qs.set("search", search);
    return reply.redirect(`/admin/links?${qs.toString()}`);
  }

  const data = await svc.getUrlsPaginated(app.db, page, limit, search, sort);
  reply.header("Cache-Control", "private, max-age=5");
  return reply.view("pages/dashboard/components/url-table.ejs", {
    ...data,
    page,
    limit,
    baseUrl: app.config.BASE_URL,
    layout: false,
  });
}

export async function createUrl(
  app: FastifyInstance,
  req: FastifyRequest<{
    Body: {
      originalUrl: string;
      customAlias?: string;
      expiresAt?: string;
      password?: string;
      title?: string;
      description?: string;
      ogImageUrl?: string;
    };
  }>,
  reply: FastifyReply,
) {
  try {
    const shortcode = await svc.createUrl(app.db, req.body);
    void logActivity(app.db, {
      adminId: req.user.id,
      action: "url.create",
      description: `Membuat shortlink /${shortcode} → ${req.body.originalUrl.substring(0, 80)}`,
      metadata: { shortcode, originalUrl: req.body.originalUrl },
      ipAddress: getIp(req),
    });
    return reply
      .status(201)
      .header(
        "HX-Trigger",
        JSON.stringify({
          urlCreated: true,
          showToast: {
            message: `Shortlink "/${shortcode}" berhasil dibuat!`,
            type: "success",
          },
        }),
      )
      .send();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const message =
      code === "INVALID_ALIAS"
        ? "Alias hanya boleh mengandung huruf, angka, - dan _."
        : code === "DUPLICATE_ALIAS"
          ? "Alias tersebut sudah digunakan. Pilih alias lain."
          : "Gagal membuat shortlink. Coba lagi.";
    return reply
      .status(400)
      .header("HX-Retarget", "#create-error")
      .view("pages/dashboard/components/form-error.ejs", { error: message, layout: false });
  }
}

export async function updateUrl(
  app: FastifyInstance,
  req: FastifyRequest<{
    Params: { id: string };
    Body: {
      originalUrl?: string;
      shortcode?: string;
      isActive?: string | boolean;
      expiresAt?: string;
      password?: string;
      clearPassword?: string;
      title?: string;
      description?: string;
      ogImageUrl?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  try {
    await svc.updateUrl(app.db, app.redis, id, req.body);
    void logActivity(app.db, {
      adminId: req.user.id,
      action: "url.update",
      description: `Memperbarui shortlink #${id}${req.body.shortcode ? ` (/${req.body.shortcode})` : ""}`,
      metadata: { id },
      ipAddress: getIp(req),
    });
    return reply
      .status(200)
      .header(
        "HX-Trigger",
        JSON.stringify({
          urlUpdated: true,
          showToast: {
            message: "Shortlink berhasil diperbarui.",
            type: "success",
          },
        }),
      )
      .send();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const message =
      code === "INVALID_SHORTCODE"
        ? "Shortcode hanya boleh mengandung huruf, angka, - dan _."
        : code === "SHORTCODE_TAKEN"
          ? "Shortcode tersebut sudah digunakan. Pilih yang lain."
          : "Gagal memperbarui shortlink. Coba lagi.";
    return reply
      .status(400)
      .header("HX-Retarget", "#edit-error")
      .view("pages/dashboard/components/form-error.ejs", { error: message, layout: false });
  }
}

export async function toggleUrl(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string }; Body: { isActive: string } }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  const isActive = req.body.isActive === "true";
  const shortcode = await svc.toggleUrlActive(app.db, app.redis, id, isActive);
  void logActivity(app.db, {
    adminId: req.user.id,
    action: "url.toggle",
    description: `${isActive ? "Mengaktifkan" : "Menonaktifkan"} shortlink${shortcode ? ` /${shortcode}` : ` #${id}`}`,
    metadata: { id, shortcode, isActive },
    ipAddress: getIp(req),
  });
  const status = isActive ? "diaktifkan" : "dinonaktifkan";
  return reply
    .status(200)
    .header(
      "HX-Trigger",
      JSON.stringify({
        showToast: {
          message: `Shortlink berhasil ${status}.`,
          type: "success",
        },
      }),
    )
    .send();
}

export async function deleteUrl(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  const shortcode = await svc.deleteUrl(app.db, app.redis, id);
  void logActivity(app.db, {
    adminId: req.user.id,
    action: "url.delete",
    description: `Menghapus shortlink${shortcode ? ` /${shortcode}` : ` #${id}`}`,
    metadata: { id, shortcode },
    ipAddress: getIp(req),
  });
  return reply
    .status(200)
    .header(
      "HX-Trigger",
      JSON.stringify({
        urlDeleted: true,
        showToast: {
          message: shortcode
            ? `Shortlink "/${shortcode}" beserta semua data analytics berhasil dihapus.`
            : "Shortlink berhasil dihapus.",
          type: "success",
        },
      }),
    )
    .send();
}

export async function getQrCode(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  const row = await svc.getUrlById(app.db, id);
  if (!row) return reply.status(404).send({ error: "Not found" });

  const shortUrl = `${app.config.BASE_URL}/${row.shortcode}`;
  const qrDataUrl = await svc.generateQrCode(shortUrl);
  reply.header("Cache-Control", "private, max-age=3600");
  return reply.view("pages/dashboard/components/qr-modal.ejs", {
    qrDataUrl,
    shortUrl,
    layout: false,
  });
}

export async function getEditModal(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  const row = await svc.getUrlById(app.db, id);
  if (!row) return reply.status(404).send({ error: "Not found" });
  return reply.view("pages/dashboard/components/edit-modal.ejs", {
    url: row,
    layout: false,
  });
}
