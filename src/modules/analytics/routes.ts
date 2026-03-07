import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { clicks, urls } from "../../db/schema.ts";

export default async function analyticsRoutes(app: FastifyInstance) {
  const adminOpts = { preHandler: [app.authenticate] };

  app.delete<{ Params: { id: string } }>(
    "/admin/analytics/:id/reset",
    adminOpts,
    async (req, reply) => {
      const urlId = Number(req.params.id);

      await Promise.all([
        app.db.delete(clicks).where(eq(clicks.urlId, urlId)),
        app.db.update(urls).set({ totalClicks: 0 }).where(eq(urls.id, urlId)),
      ]);

      return reply.header("HX-Trigger", "analyticsReset").status(200).send();
    },
  );
}
