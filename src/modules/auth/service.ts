import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.ts";
import { admins } from "../../db/schema.ts";

export async function findAdminByUsername(db: DB, username: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);
  return admin ?? null;
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}
