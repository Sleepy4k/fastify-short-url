import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { settings } from "../../db/schema.ts";

interface UpdateSettingBody {
  value: string;
}

export default async function settingsRoutes(app: FastifyInstance) {
  const adminOpts = { preHandler: [app.authenticate] };

  app.patch<{ Params: { key: string }; Body: UpdateSettingBody }>(
    "/admin/settings/:key",
    adminOpts,
    async (req, reply) => {
      const { key } = req.params;
      const { value } = req.body;

      await app.db.update(settings).set({ value }).where(eq(settings.key, key));
      await app.redis.del("app:settings");

      const [row] = await app.db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      return reply.view("admin/partials/setting-row.ejs", {
        setting: row,
        layout: false,
      });
    },
  );
}
