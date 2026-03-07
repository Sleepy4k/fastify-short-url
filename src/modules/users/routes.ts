import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { admins } from "../../db/schema.ts";

interface CreateUserBody {
  username: string;
  password: string;
}

export default async function usersRoutes(app: FastifyInstance) {
  const authOpts = { preHandler: [app.authenticate] };

  app.post<{ Body: CreateUserBody }>(
    "/admin/users",
    authOpts,
    async (req, reply) => {
      if (req.user.role !== "superadmin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const { username, password } = req.body;

      if (!username || username.length < 3 || username.length > 64) {
        return reply
          .status(400)
          .header("HX-Retarget", "#user-error")
          .view("admin/partials/form-error.ejs", {
            error: "Username must be 3–64 characters.",
            layout: false,
          });
      }
      if (!password || password.length < 6) {
        return reply
          .status(400)
          .header("HX-Retarget", "#user-error")
          .view("admin/partials/form-error.ejs", {
            error: "Password must be at least 6 characters.",
            layout: false,
          });
      }

      const passwordHash = await Bun.password.hash(password, {
        algorithm: "argon2id",
      });

      try {
        await app.db
          .insert(admins)
          .values({ username, passwordHash, role: "admin" });
      } catch (err: unknown) {
        const isDuplicate =
          err instanceof Error && err.message.includes("Duplicate entry");
        return reply
          .status(400)
          .header("HX-Retarget", "#user-error")
          .view("admin/partials/form-error.ejs", {
            error: isDuplicate
              ? "Username already exists."
              : "Could not create user.",
            layout: false,
          });
      }

      return reply.header("HX-Trigger", "userCreated").status(201).send();
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/admin/users/:id",
    authOpts,
    async (req, reply) => {
      if (req.user.role !== "superadmin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const id = Number(req.params.id);

      if (id === req.user.id) {
        return reply.status(400).send({ error: "Cannot delete yourself" });
      }

      await app.db.delete(admins).where(eq(admins.id, id));
      return reply.header("HX-Trigger", "userDeleted").status(200).send();
    },
  );
}
