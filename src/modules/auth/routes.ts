import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { admins } from "../../db/schema.ts";

interface LoginBody {
  username: string;
  password: string;
}

export default async function authRoutes(app: FastifyInstance) {
  app.get("/login", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify({ onlyCookie: true });
      return reply.redirect("/");
    } catch {
      // not authenticated
    }
    return reply.view("auth/login.ejs", { error: null, layout: false });
  });

  app.post<{ Body: LoginBody }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1, maxLength: 64 },
            password: { type: "string", minLength: 1, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body;

      const [admin] = await app.db
        .select()
        .from(admins)
        .where(eq(admins.username, username))
        .limit(1);

      const valid = admin
        ? await Bun.password.verify(password, admin.passwordHash)
        : false;

      if (!admin || !valid) {
        const msg = "Invalid username or password.";
        if (req.headers["hx-request"]) {
          return reply
            .status(401)
            .header("HX-Retarget", "#login-error")
            .view("auth/partials/login-error.ejs", {
              error: msg,
              layout: false,
            });
        }
        return reply.view("auth/login.ejs", { error: msg, layout: false });
      }

      const token = app.jwt.sign({
        id: admin.id,
        username: admin.username,
        role: admin.role ?? "admin",
      });
      reply.setCookie("token", token, {
        path: "/",
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 8,
      });

      if (req.headers["hx-request"]) {
        return reply.header("HX-Redirect", "/").status(200).send();
      }
      return reply.redirect("/");
    },
  );

  app.post("/logout", async (_req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return reply.redirect("/login");
  });
}
