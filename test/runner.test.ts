import test from "node:test";
import assert from "node:assert/strict";
import { dispatchOrders } from "../src/fixture/orders-api.ts";
import { validatePlannerResult, PlanValidationError } from "../src/core/plan.ts";
import { DeterministicStubPlanner } from "../src/core/planner.ts";
import { runPlan, verifyFrozenReproduction } from "../src/core/runner.ts";
import { exportNodeTest } from "../src/core/exporter.ts";
import type { ReproductionPlan } from "../src/types.ts";

const plan: ReproductionPlan = {
  version: 1,
  fixture: "synthetic-orders",
  report: "Shipped page 1 is short even though total is 4.",
  requests: [{ method: "GET", path: "/orders", query: { status: "shipped", limit: 2, offset: 0 } }],
  assertions: [
    { type: "equals", path: "$.total", expected: 4 },
    { type: "array-length", path: "$.items", expected: 2 }
  ]
};

test("fixture variants preserve totals but differ in pagination order", () => {
  const buggy = dispatchOrders("buggy", plan.requests[0]);
  const corrected = dispatchOrders("corrected", plan.requests[0]);
  assert.equal(buggy.total, 4);
  assert.equal(corrected.total, 4);
  assert.equal(buggy.items.length, 1);
  assert.equal(corrected.items.length, 2);
});

test("runner reports the assertion failure and trace on buggy target", () => {
  const result = runPlan(plan, "buggy");
  assert.equal(result.status, "failed");
  assert.ok(result.assertions.some((item) => !item.passed));
  assert.deepEqual(result.trace.map((event) => event.phase), ["request", "response", "assertion", "assertion", "complete"]);
});

test("frozen verification requires buggy fail and corrected pass", () => {
  const result = verifyFrozenReproduction(plan);
  assert.equal(result.status, "verified");
  assert.equal(result.evidence, "deterministic-stub");
  assert.equal(result.buggy.status, "failed");
  assert.equal(result.corrected.status, "passed");
});

test("stub planner turns the report into a bounded plan", async () => {
  const result = await new DeterministicStubPlanner().propose("status=shipped limit=2 offset=0 returns one item but total is 4");
  assert.equal("kind" in result ? result.kind : undefined, undefined);
  if ("kind" in result) return;
  assert.equal(result.requests[0].path, "/orders");
  assert.equal(result.requests[0].query.status, "shipped");
});

test("vague reports request clarification", async () => {
  const result = await new DeterministicStubPlanner().propose("works fine");
  assert.equal("kind" in result ? result.kind : undefined, "clarification");
});

test("validator rejects arbitrary URLs, headers, and excessive bounds", () => {
  assert.throws(() => validatePlannerResult({ ...plan, requests: [{ method: "GET", path: "https://example.com", query: { limit: 1, offset: 0 } }] }), PlanValidationError);
  assert.throws(() => validatePlannerResult({ ...plan, requests: [{ method: "GET", path: "/orders", query: { limit: 99, offset: 0 } }] }), PlanValidationError);
  assert.throws(() => validatePlannerResult({ ...plan, requests: [{ method: "GET", path: "/orders", query: { limit: 1, offset: 0, headers: {} } }] }), PlanValidationError);
});

test("runner honors cancellation", () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(runPlan(plan, "buggy", { signal: controller.signal }).status, "cancelled");
});

test("exported reproduction is a fixed runner template, not model-generated code", () => {
  const source = exportNodeTest(plan);
  assert.match(source, /runPlan\(plan, "buggy"\)/);
  assert.doesNotMatch(source, /propose\(|OptionalModelPlanner|fetch\(/);
});
