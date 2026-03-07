import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";

export default fp(
  async function staticPlugin(app: FastifyInstance) {
    await app.register(fastifyStatic, {
      root: path.join(app.entryPath, "public"),
      prefix: "/assets/",
    });
  },
  { name: "static-plugin" },
);
