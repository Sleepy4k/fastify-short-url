import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: number; username: string; role: string };
    user: { id: number; username: string; role: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(
  async function authPlugin(app: FastifyInstance) {
    await app.register(fastifyCookie, {
      secret: app.config.COOKIE_SECRET,
      hook: "onRequest",
    });

    await app.register(fastifyJwt, {
      secret: app.config.JWT_SECRET,
      cookie: {
        cookieName: "token",
        signed: false,
      },
      sign: {
        expiresIn: "8h",
      },
    });

    app.decorate(
      "authenticate",
      async function authenticate(req: FastifyRequest, reply: FastifyReply) {
        try {
          await req.jwtVerify({ onlyCookie: true });
        } catch {
          if (req.headers["hx-request"]) {
            reply.header("HX-Redirect", "/login").status(401).send();
          } else {
            reply.redirect("/login");
          }
        }
      },
    );
  },
  { name: "auth-plugin", dependencies: ["env-plugin"] },
);
