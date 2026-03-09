import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";
import { logActivity } from "../logs/service.ts";

function getIp(req: FastifyRequest): string {
  return (
    ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip) || ""
  );
}

export async function createUser(
  app: FastifyInstance,
  req: FastifyRequest<{ Body: { username: string; password: string } }>,
  reply: FastifyReply,
) {
  if (req.user.role !== "superadmin") {
    return reply.status(403).send({ error: "Forbidden" });
  }

  const { username, password } = req.body;

  try {
    await svc.createUser(app.db, username, password);
    void logActivity(app.db, {
      adminId: req.user.id,
      action: "user.create",
      description: `Membuat pengguna admin: ${username}`,
      metadata: { username },
      ipAddress: getIp(req),
    });
    return reply
      .status(201)
      .header(
        "HX-Trigger",
        JSON.stringify({
          userCreated: true,
          showToast: {
            message: `Pengguna "${username}" berhasil dibuat dengan role admin.`,
            type: "success",
          },
        }),
      )
      .send();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const message =
      code === "INVALID_USERNAME"
        ? "Username harus terdiri dari 3–64 karakter."
        : code === "INVALID_PASSWORD"
          ? "Password minimal 6 karakter."
          : code === "DUPLICATE_USERNAME"
            ? `Username "${username}" sudah digunakan. Pilih username yang berbeda.`
            : "Gagal membuat pengguna. Coba lagi.";
    return reply
      .status(400)
      .header("HX-Retarget", "#user-form-error")
      .view("pages/dashboard/components/form-error.ejs", { error: message, layout: false });
  }
}

export async function deleteUser(
  app: FastifyInstance,
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  if (req.user.role !== "superadmin") {
    return reply.status(403).send({ error: "Forbidden" });
  }

  const id = Number(req.params.id);

  try {
    const username = await svc.deleteUser(app.db, id, req.user.id);
    void logActivity(app.db, {
      adminId: req.user.id,
      action: "user.delete",
      description: `Menghapus pengguna admin: ${username ?? `#${id}`}`,
      metadata: { id, username },
      ipAddress: getIp(req),
    });
    return reply
      .status(200)
      .header(
        "HX-Trigger",
        JSON.stringify({
          userDeleted: true,
          showToast: {
            message: username
              ? `Pengguna "${username}" berhasil dihapus dari sistem.`
              : "Pengguna berhasil dihapus.",
            type: "success",
          },
        }),
      )
      .send();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "SELF_DELETE") {
      return reply
        .status(400)
        .send({ error: "Anda tidak dapat menghapus akun Anda sendiri." });
    }
    return reply.status(500).send({ error: "Gagal menghapus pengguna." });
  }
}
