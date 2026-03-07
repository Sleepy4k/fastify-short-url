import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as svc from "./service.ts";

export async function loginPage(
  _app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await req.jwtVerify({ onlyCookie: true });
    return reply.redirect("/");
  } catch {
    // not authenticated
  }
  return reply.view("auth/login.ejs", { error: null, layout: false });
}

export async function handleLogin(
  app: FastifyInstance,
  req: FastifyRequest<{ Body: { username: string; password: string } }>,
  reply: FastifyReply,
) {
  const { username, password } = req.body;
  const admin = await svc.findAdminByUsername(app.db, username);
  const valid = admin
    ? await svc.verifyPassword(admin.passwordHash, password)
    : false;

  if (!admin || !valid) {
    const msg =
      "Username atau password salah. Periksa kembali kredensial Anda.";
    if (req.headers["hx-request"]) {
      return reply
        .status(401)
        .header("HX-Retarget", "#login-error")
        .header(
          "HX-Trigger",
          JSON.stringify({ showLoginToast: { message: msg, type: "error" } }),
        )
        .view("auth/partials/login-error.ejs", { error: msg, layout: false });
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
    secure: app.config.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });

  if (req.headers["hx-request"]) {
    return reply.header("HX-Redirect", "/").status(200).send();
  }
  return reply.redirect("/");
}

export async function handleLogout(
  _app: FastifyInstance,
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  reply.clearCookie("token", { path: "/" });
  return reply.redirect("/login");
}
