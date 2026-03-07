import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { admins } from "../../db/schema.ts";
import type { UpdatePasswordDto } from "../../types/index.ts";

export async function getProfile(db: DB, userId: number) {
  const [admin] = await db
    .select({
      id: admins.id,
      username: admins.username,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(eq(admins.id, userId))
    .limit(1);
  return admin ?? null;
}

export async function updatePassword(
  db: DB,
  userId: number,
  dto: UpdatePasswordDto,
) {
  if (!dto.currentPassword || !dto.newPassword) {
    const e = new Error("Semua kolom password harus diisi.");
    (e as { code?: string }).code = "MISSING_FIELDS";
    throw e;
  }
  if (dto.newPassword.length < 6) {
    const e = new Error("Password baru minimal 6 karakter.");
    (e as { code?: string }).code = "INVALID_PASSWORD";
    throw e;
  }

  const [admin] = await db
    .select({ passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.id, userId))
    .limit(1);

  if (!admin) {
    const e = new Error("Akun tidak ditemukan.");
    (e as { code?: string }).code = "NOT_FOUND";
    throw e;
  }

  const valid = await Bun.password.verify(
    dto.currentPassword,
    admin.passwordHash,
  );
  if (!valid) {
    const e = new Error("Password saat ini salah.");
    (e as { code?: string }).code = "WRONG_PASSWORD";
    throw e;
  }

  const newHash = await Bun.password.hash(dto.newPassword, {
    algorithm: "argon2id",
  });
  await db
    .update(admins)
    .set({ passwordHash: newHash })
    .where(eq(admins.id, userId));
}
