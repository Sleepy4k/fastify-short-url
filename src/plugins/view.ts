import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import path from "path";

export default fp(
  async function viewPlugin(app: FastifyInstance) {
    await app.register(fastifyView, {
      engine: { ejs },
      root: path.join(import.meta.dir, "..", "views"),
      layout: "layouts/main.ejs",
      viewExt: "ejs",
      options: {
        rmWhitespace: true,
      },
      defaultContext: {
        appName: "ShortURL",
        baseUrl: process.env["BASE_URL"] ?? "http://localhost:3000",
      },
    });
  },
  { name: "view-plugin" },
);
