import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const candidates = [
  process.env.API_BUG_REPRODUCER_TSC,
  "/usr/local/lib/node_modules/vercel/node_modules/typescript/bin/tsc",
  "/usr/local/lib/node_modules/typescript/bin/tsc"
].filter(Boolean);
const compiler = candidates.find((candidate) => existsSync(candidate));
if (!compiler) {
  console.error("TypeScript compiler not available; typecheck not run.");
  process.exit(2);
}
const bundledTypes = resolve(dirname(compiler), "../../@types");
const args = [compiler, "--noEmit", "--project", "tsconfig.json", "--pretty", "false"];
if (existsSync(bundledTypes)) args.push("--typeRoots", bundledTypes);
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.status === 0) console.log(`TypeScript compiler check passed with ${compiler}.`);
process.exit(result.status ?? 1);
