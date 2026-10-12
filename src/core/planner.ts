import { validatePlannerResult } from "./plan.ts";
import { FIXTURE_NAME, type PlannerResult, type ReproductionPlan } from "../types.ts";

export interface Planner {
  readonly name: string;
  propose(report: string): Promise<PlannerResult>;
}

export class DeterministicStubPlanner implements Planner {
  readonly name = "deterministic-stub";

  async propose(report: string): Promise<PlannerResult> {
    const normalized = report.trim().toLowerCase();
    if (normalized.length < 8 || /^(works|working|no issue|all good)\b/.test(normalized) || /\b(correct|correctly|no bug|not a bug)\b/.test(normalized)) {
      return {
        kind: "clarification",
        report,
        reason: "The report does not identify an observable API behavior to reproduce.",
        questions: ["Which order status and page size expose the issue?", "What response field is incorrect or missing?"]
      };
    }

    const status = /\b(shipped|pending|processing|cancelled)\b/.exec(normalized)?.[1] as ReproductionPlan["requests"][number]["query"]["status"] | undefined;
    const offsetMatch = /\boffset\s*(?:=|is|of)?\s*(\d+)/.exec(normalized);
    const limitMatch = /\blimit\s*(?:=|is|of)?\s*(\d+)/.exec(normalized);
    const totalMatch = /\btotal\s*(?:=|is|of)?\s*(\d+)/.exec(normalized);
    const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
    const limit = limitMatch ? Number(limitMatch[1]) : 2;
    const requests = [{ method: "GET" as const, path: "/orders" as const, query: { ...(status ? { status } : {}), limit, offset } }];
    const assertions = [
      { type: "equals" as const, path: "$.total", expected: totalMatch ? Number(totalMatch[1]) : status ? countFor(status) : 8 },
      { type: "equals" as const, path: "$.limit", expected: limit },
      { type: "equals" as const, path: "$.offset", expected: offset },
      { type: "array-length" as const, path: "$.items", expected: expectedItemCount(status, limit, offset) }
    ];
    return validatePlannerResult({ version: 1, fixture: FIXTURE_NAME, report, requests, assertions });
  }
}

function countFor(status: string): number {
  return status === "shipped" ? 4 : status === "pending" ? 2 : status === "processing" || status === "cancelled" ? 1 : 8;
}

function expectedItemCount(status: string | undefined, limit: number, offset: number): number {
  const total = status ? countFor(status) : 8;
  return Math.max(0, Math.min(limit, total - offset));
}
