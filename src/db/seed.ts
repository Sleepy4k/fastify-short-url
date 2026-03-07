import { admins, settings } from "./schema.ts";
import type { DB } from "./connection.ts";

async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: "argon2id" });
}

export async function seed(db: DB) {
  const passwordHash = await hashPassword("admin123");
  await db
    .insert(admins)
    .values({ username: "admin", passwordHash, role: "superadmin" })
    .onDuplicateKeyUpdate({ set: { role: "superadmin" } });

  // ── Default Settings ───────────────────────────────────────────────────────
  const defaultSettings = [
    {
      key: "app_name",
      value: "ShortURL",
      type: "string" as const,
      label: "Application Name",
      description: "The public name of this service.",
    },
    {
      key: "default_expiry_days",
      value: "0",
      type: "number" as const,
      label: "Default Expiry (days)",
      description: "Default link lifetime in days. 0 = never expires.",
    },
    {
      key: "maintenance_mode",
      value: "false",
      type: "boolean" as const,
      label: "Maintenance Mode",
      description: "When enabled, all redirects return 503.",
    },
    {
      key: "allow_custom_alias",
      value: "true",
      type: "boolean" as const,
      label: "Allow Custom Alias",
      description: "Let users specify custom shortcodes.",
    },
    {
      key: "max_alias_length",
      value: "32",
      type: "number" as const,
      label: "Max Alias Length",
      description: "Maximum character length for custom aliases.",
    },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(settings)
      .values(s)
      .onDuplicateKeyUpdate({ set: { label: s.label } });
  }
}

// Allow running directly: bun run src/db/seed.ts
if (import.meta.main) {
  const { createDbConnection } = await import("./connection.ts");
  const db = await createDbConnection();
  await seed(db);
  process.exit(0);
}
