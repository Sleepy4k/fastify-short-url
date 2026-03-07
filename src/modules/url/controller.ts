import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";

export async function handleRedirect(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { code: string } }>,
  reply: FastifyReply,
) {
  const { code } = req.params;
  const result = await svc.resolveRedirect(app.db, app.redis, code);

  if (result.status === "active") {
    setImmediate(() => void svc.recordClick(app.db, code, req));
    return reply
      .status(301)
      .header("Cache-Control", "public, max-age=3600")
      .header("ETag", code)
      .redirect(result.url);
  }
  if (result.status === "expired") {
    return reply.status(410).view("errors/expired.ejs", { layout: false });
  }
  return reply.status(404).view("errors/404.ejs", { layout: false });
}

export async function listUrls(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const q = req.query as { page?: string; limit?: string };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
  const data = await svc.getUrlsPaginated(app.db, page, limit);
  reply.header("Cache-Control", "private, max-age=5");
  return reply.view("admin/partials/url-table.ejs", {
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
    Body: { originalUrl: string; customAlias?: string; expiresAt?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const shortcode = await svc.createUrl(app.db, req.body);
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
      .view("admin/partials/form-error.ejs", { error: message, layout: false });
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
    };
  }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  try {
    await svc.updateUrl(app.db, app.redis, id, req.body);
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
      .view("admin/partials/form-error.ejs", { error: message, layout: false });
  }
}

export async function deleteUrl(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const id = Number(req.params.id);
  const shortcode = await svc.deleteUrl(app.db, app.redis, id);
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
  return reply.view("admin/partials/qr-modal.ejs", {
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
  return reply.view("admin/partials/edit-modal.ejs", {
    url: row,
    layout: false,
  });
}
