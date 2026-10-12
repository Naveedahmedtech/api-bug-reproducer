import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "scripts", "test"];
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (path.endsWith(".ts")) files.push(path);
  }
}
for (const root of roots) await walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--check", file], { encoding: "utf8" });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(result.status ?? 1); }
}
console.log(`${process.argv.includes("--types") ? "TypeScript syntax/type-surface" : "Source"} check passed for ${files.length} files (Node 22+ strip-types mode).`);
