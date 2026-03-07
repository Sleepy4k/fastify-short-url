import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply } from "fastify";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import path from "path";

declare module "fastify" {
  interface FastifyInstance {
    entryPath: string;
  }
  interface FastifyReply {
    render(template: string, data?: Record<string, unknown>): Promise<string>;
  }
}

function autoLayout(template: string): string | false {
  const t = template.replace(/\\/g, "/");
  if (t.includes("/partials/") || t.startsWith("partials/")) return false;
  if (t.startsWith("errors/")) return false;
  if (t.startsWith("auth/")) return false;
  if (t.startsWith("admin/dashboard")) return false;
  return "layouts/main.ejs";
}

export default fp(
  async function viewPlugin(app: FastifyInstance) {
    await app.register(fastifyView, {
      engine: { ejs },
      root: path.join(app.entryPath, "views"),
      layout: "" as unknown as string,
      viewExt: "ejs",
      options: {
        rmWhitespace: true,
      },
      defaultContext: {
        appName: "ShortURL",
        baseUrl: process.env["BASE_URL"] ?? "http://localhost:3000",
      },
    });

    app.decorateReply(
      "render",
      async function (
        this: FastifyReply,
        template: string,
        data: Record<string, unknown> = {},
      ) {
        const layout =
          data.layout !== undefined ? data.layout : autoLayout(template);
        return this.view(template, { ...data, layout });
      },
    );
  },
  { name: "view-plugin" },
);
