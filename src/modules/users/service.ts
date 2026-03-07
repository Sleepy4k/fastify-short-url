import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { admins } from "../../db/schema.ts";

export async function createUser(db: DB, username: string, password: string) {
  if (!username || username.length < 3 || username.length > 64) {
    const e = new Error("Username harus terdiri dari 3–64 karakter.");
    (e as { code?: string }).code = "INVALID_USERNAME";
    throw e;
  }
  if (!password || password.length < 6) {
    const e = new Error("Password minimal 6 karakter.");
    (e as { code?: string }).code = "INVALID_PASSWORD";
    throw e;
  }

  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
  });

  try {
    await db.insert(admins).values({ username, passwordHash, role: "admin" });
  } catch (err: unknown) {
    const isDup =
      err instanceof Error && err.message.includes("Duplicate entry");
    if (isDup) {
      const e = new Error(
        `Username "${username}" sudah digunakan. Pilih username yang berbeda.`,
      );
      (e as { code?: string }).code = "DUPLICATE_USERNAME";
      throw e;
    }
    throw err;
  }
}

export async function deleteUser(db: DB, id: number, currentUserId: number) {
  if (id === currentUserId) {
    const e = new Error("Anda tidak dapat menghapus akun Anda sendiri.");
    (e as { code?: string }).code = "SELF_DELETE";
    throw e;
  }
  const [user] = await db
    .select({ username: admins.username })
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1);
  await db.delete(admins).where(eq(admins.id, id));
  return user?.username;
}

export async function getUsers(db: DB) {
  return db
    .select({
      id: admins.id,
      username: admins.username,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.createdAt);
}
