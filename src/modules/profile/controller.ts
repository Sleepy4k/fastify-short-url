import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";
import type { UpdatePasswordDto } from "../../types/index.ts";

export async function profilePage(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const profile = await svc.getProfile(app.db, req.user.id);
  if (!profile) return reply.status(404).send();

  if (req.headers["hx-request"]) {
    return reply.view("pages/dashboard/components/profile.ejs", {
      profile,
      layout: false,
    });
  }

  // Direct navigation — wrap in full dashboard shell
  const ejs = await import("ejs");
  const path = await import("path");
  const viewsDir = path.join(import.meta.dir, "../../views");
  const panelHtml = await ejs.renderFile(
    path.join(viewsDir, "pages/dashboard/components/profile.ejs"),
    { profile },
    { rmWhitespace: true },
  );
  const siteSettings = await app.getSettings();
  return reply.view("pages/dashboard/index.ejs", {
    user: req.user,
    tab: "profile",
    panelHtml,
    appName: siteSettings["app_name"] ?? "ShortURL",
    maintenanceMode: siteSettings["maintenance_mode"] === "true",
    layout: false,
  });
}

export async function updatePassword(
  app: FastifyInstance,
  req: FastifyRequest<{ Body: UpdatePasswordDto }>,
  reply: FastifyReply,
) {
  try {
    await svc.updatePassword(app.db, req.user.id, req.body);
    reply.header(
      "HX-Trigger",
      JSON.stringify({
        showToast: { message: "Password berhasil diperbarui.", type: "success" },
      }),
    );
    return reply.view("pages/dashboard/components/form-error.ejs", { layout: false });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.";
    return reply
      .status(400)
      .view("pages/dashboard/components/form-error.ejs", { error: message, layout: false });
  }
}
