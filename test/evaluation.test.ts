import test from "node:test";
import assert from "node:assert/strict";
import { reproduce } from "../src/app.ts";

const heldOut = [
    { name: "boundary offset", report: "shipped orders at limit 2 offset 2 return a short page", shouldVerify: true },
  { name: "correct behavior claim", report: "the shipped orders endpoint is correct and returns four items total", shouldVerify: false },
  { name: "missing details", report: "orders pagination is wrong", shouldVerify: true },
  { name: "misleading report", report: "status=shipped limit=1 offset=0 returns a wrong total of 99", shouldVerify: false }
];

test("held-out fixture set reports deterministic limitations", async () => {
  const results = [];
  for (const item of heldOut) {
    const result = await reproduce(item.report);
    results.push({ name: item.name, kind: "kind" in result ? result.kind : "reproduction", verified: "kind" in result ? false : result.verification.status === "verified" });
  }
  assert.deepEqual(results, [
    { name: "boundary offset", kind: "reproduction", verified: true },
    { name: "correct behavior claim", kind: "clarification", verified: false },
    { name: "missing details", kind: "reproduction", verified: false },
    { name: "misleading report", kind: "reproduction", verified: false }
  ]);
});
