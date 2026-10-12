import { exportNodeTest } from "./core/exporter.ts";
import { validatePlannerResult } from "./core/plan.ts";
import { DeterministicStubPlanner, type Planner } from "./core/planner.ts";
import { verifyFrozenReproduction } from "./core/runner.ts";
import type { ReproductionOutput } from "./types.ts";

export async function reproduce(report: string, planner: Planner = new DeterministicStubPlanner()): Promise<ReproductionOutput | { kind: "clarification"; report: string; questions: string[]; reason: string }> {
  const result = validatePlannerResult(await planner.propose(report));
  if ("kind" in result) return result;
  const verification = verifyFrozenReproduction(result);
  return { plan: result, verification, exportedTest: exportNodeTest(result) };
}
