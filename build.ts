import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dir);

console.log("📦  Bundling...");
const t0 = performance.now();

const result = await Bun.build({
  entrypoints: [path.join(ROOT, "src/server.ts")],
  outdir: path.join(ROOT, "dist"),
  minify: true,
  sourcemap: "none",
  target: "bun",
  external: ["mysql2", "redis"],
});

if (!result.success) {
  console.error("❌  Build failed:");
  for (const msg of result.logs) console.error("   ", msg);
  process.exit(1);
}

const elapsed = (performance.now() - t0).toFixed(0);
for (const file of result.outputs) {
  const kb = (file.size / 1024).toFixed(1);
  console.log(
    `   ✓ ${path.relative(ROOT, file.path)}  (${kb} KB)  [${elapsed} ms]`,
  );
}

async function copyDir(src: string, dest: string): Promise<number> {
  if (!fs.existsSync(src)) {
    console.warn(`⚠   Skipping missing directory: ${path.relative(ROOT, src)}`);
    return 0;
  }
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(s, d);
    } else {
      await Bun.write(d, Bun.file(s));
      count++;
    }
  }
  return count;
}

console.log("\n🗂   Copying static assets...");
const [viewCount, assetCount] = await Promise.all([
  copyDir(path.join(ROOT, "src/views"), path.join(ROOT, "dist/views")),
  copyDir(path.join(ROOT, "src/public"), path.join(ROOT, "dist/public")),
]);
console.log(`   ✓ ${viewCount} view templates → dist/views/`);
console.log(`   ✓ ${assetCount} public assets  → dist/public/`);

console.log("\n✅  Build complete → dist/server.js\n");

export {};
