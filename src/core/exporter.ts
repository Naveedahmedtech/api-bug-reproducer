import type { ReproductionPlan } from "../types.ts";

export function exportNodeTest(plan: ReproductionPlan): string {
  const planJson = JSON.stringify(plan, null, 2);
  return `import test from "node:test";
import assert from "node:assert/strict";
import { runPlan } from "../src/core/runner.ts";

const plan = ${planJson};

test("frozen API bug reproduction", () => {
  const buggy = runPlan(plan, "buggy");
  const corrected = runPlan(plan, "corrected");
  assert.equal(buggy.status, "failed", "the buggy fixture should fail the plan");
  assert.equal(corrected.status, "passed", "the corrected fixture should pass the plan");
});
`;
}
