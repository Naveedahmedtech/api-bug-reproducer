import { mkdir, writeFile } from "node:fs/promises";
import { reproduce } from "../src/app.ts";

const report = "GET /orders with status=shipped, limit=2, offset=0 returns one item even though total is 4.";
const result = await reproduce(report);
if ("kind" in result) throw new Error("Demo report unexpectedly needs clarification.");
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/reproduction.json", JSON.stringify(result, null, 2));
await writeFile("artifacts/reproduction.test.mjs", result.exportedTest);
console.log(JSON.stringify({ verification: result.verification.status, buggy: result.verification.buggy.status, corrected: result.verification.corrected.status, files: ["artifacts/reproduction.json", "artifacts/reproduction.test.mjs"] }, null, 2));
