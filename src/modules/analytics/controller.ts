import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";

export async function resetAnalytics(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const urlId = Number(req.params.id);
  const shortcode = await svc.resetAnalytics(app.db, urlId);
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
