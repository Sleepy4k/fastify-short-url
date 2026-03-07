import fs from "fs";
import path from "path";

Bun.build({
  entrypoints: ["src/server.ts"],
  outdir: "dist",
  minify: true,
  sourcemap: true,
  target: "bun",
  external: ["mysql2", "redis"],
});

function copyFolderSync(source: string, destination: string) {
  if (!fs.existsSync(source)) {
    console.error("Source folder not found");
    process.exit(1);
  }

  fs.mkdirSync(destination, { recursive: true });

  for (const item of fs.readdirSync(source)) {
    const sourceItem = path.join(source, item);
    const destinationItem = path.join(destination, item);
    const stat = fs.statSync(sourceItem);

    if (stat.isDirectory()) {
      copyFolderSync(sourceItem, destinationItem);
    } else {
      fs.copyFileSync(sourceItem, destinationItem);
    }
  }
}

const sourceViewsDir = path.join(__dirname, "src/views");
const sourcePublicDir = path.join(__dirname, "src/public");

const distViewsDir = path.join(__dirname, "dist");
const distPublicDir = path.join(__dirname, "dist/public");

copyFolderSync(sourceViewsDir, distViewsDir);
copyFolderSync(sourcePublicDir, distPublicDir);

export {};
