import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";
import { logActivity } from "../logs/service.ts";

function getIp(req: FastifyRequest): string {
  return (
    ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip) || ""
  );
}

export async function resetAnalytics(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const urlId = Number(req.params.id);
  const shortcode = await svc.resetAnalytics(app.db, urlId);
  void logActivity(app.db, {
    adminId: req.user.id,
    action: "analytics.reset",
    description: `Mereset analytics untuk${shortcode ? ` /${shortcode}` : ` URL #${urlId}`}`,
    metadata: { urlId, shortcode },
    ipAddress: getIp(req),
  });
  return reply
    .status(200)
    .header(
      "HX-Trigger",
      JSON.stringify({
        analyticsReset: true,
        showToast: {
          message: shortcode
            ? `Analytics untuk "/${shortcode}" berhasil direset. Semua data klik telah dihapus.`
            : "Analytics berhasil direset.",
          type: "success",
        },
      }),
    )
    .send();
}
