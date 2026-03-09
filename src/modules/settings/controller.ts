import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";
import { logActivity } from "../logs/service.ts";

function getIp(req: FastifyRequest): string {
  return (
    ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip) || ""
  );
}

export async function updateSetting(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { key: string }; Body: { value: string } }>,
  reply: FastifyReply,
) {
  const { key } = req.params;
  const { value } = req.body;

  const row = await svc.updateSetting(app.db, app.redis, key, value);
  if (!row) return reply.status(404).send({ error: "Setting not found" });

  let message: string;
  if (row.type === "boolean") {
    const isEnabled = row.value === "true";
    message = `Setting "${row.label}" berhasil ${isEnabled ? "diaktifkan" : "dinonaktifkan"}.`;
  } else {
    message = `Setting "${row.label}" berhasil diperbarui menjadi: ${row.value}`;
  }

  void logActivity(app.db, {
    adminId: req.user.id,
    action: "settings.update",
    description: `Memperbarui setting "${row.label}" (${key}) = ${row.value}`,
    metadata: { key, value: row.value },
    ipAddress: getIp(req),
  });

  return reply
    .status(200)
    .header(
      "HX-Trigger",
      JSON.stringify({ showToast: { message, type: "success" } }),
    )
    .view("pages/dashboard/components/setting-row.ejs", { setting: row, layout: false });
}
