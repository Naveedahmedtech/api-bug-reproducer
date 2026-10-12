import { dispatchOrders } from "../fixture/orders-api.ts";
import type { Assertion, JsonValue, ReproductionPlan, RunResult, TargetVariant, VerificationResult } from "../types.ts";

export interface RunOptions {
  signal?: AbortSignal;
  maxIterations?: number;
  maxRuntimeMs?: number;
}

const MAX_RESPONSE_BYTES = 20_000;

export function runPlan(plan: ReproductionPlan, target: TargetVariant, options: RunOptions = {}): RunResult {
  const started = performance.now();
  const trace = [] as RunResult["trace"];
  const responses = [] as RunResult["responses"];
  const assertions = [] as RunResult["assertions"];
  const maxIterations = Math.min(options.maxIterations ?? 3, 3);
  const maxRuntimeMs = Math.min(options.maxRuntimeMs ?? 1_000, 1_000);
  let sequence = 0;
  const event = (phase: RunResult["trace"][number]["phase"], detail: Record<string, JsonValue>) => {
    trace.push({ sequence: ++sequence, phase, atMs: Math.round(performance.now() - started), detail });
  };

  try {
    for (let index = 0; index < plan.requests.length; index += 1) {
      if (index >= maxIterations) throw new Error("Iteration limit exceeded.");
      if (options.signal?.aborted) return cancelledResult(target, started, trace, responses, assertions, event);
      if (performance.now() - started > maxRuntimeMs) throw new Error("Runtime limit exceeded.");
      const request = plan.requests[index];
      event("request", { method: request.method, path: request.path, query: request.query as unknown as JsonValue });
      const response = dispatchOrders(target, request);
      const serialized = JSON.stringify(response);
      if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) throw new Error("Response-size limit exceeded.");
      responses.push(response);
      event("response", { status: 200, bytes: Buffer.byteLength(serialized, "utf8"), body: response as unknown as JsonValue });
      for (const assertion of plan.assertions) {
        const result = evaluateAssertion(assertion, response as unknown as JsonValue);
        assertions.push(result);
        event("assertion", { passed: result.passed, message: result.message, path: assertion.path });
      }
    }
    const passed = assertions.length > 0 && assertions.every((assertion) => assertion.passed);
    event("complete", { status: passed ? "passed" : "failed", assertions: assertions.length });
    return { status: passed ? "passed" : "failed", target, durationMs: Math.round(performance.now() - started), responses, assertions, trace };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runner failure.";
    event("error", { message });
    return { status: "error", target, durationMs: Math.round(performance.now() - started), responses, assertions, trace, error: message };
  }
}

function cancelledResult(target: TargetVariant, started: number, trace: RunResult["trace"], responses: RunResult["responses"], assertions: RunResult["assertions"], event: (phase: RunResult["trace"][number]["phase"], detail: Record<string, JsonValue>) => void): RunResult {
  event("complete", { status: "cancelled" });
  return { status: "cancelled", target, durationMs: Math.round(performance.now() - started), responses, assertions, trace };
}

function evaluateAssertion(assertion: Assertion, body: JsonValue): RunResult["assertions"][number] {
  const actual = getPath(body, assertion.path);
  let passed = false;
  if (assertion.type === "equals") passed = actual === assertion.expected;
  if (assertion.type === "array-length") passed = Array.isArray(actual) && actual.length === assertion.expected;
  if (assertion.type === "contains") passed = Array.isArray(actual) && actual.includes(assertion.expected);
  return { assertion, passed, actual, message: passed ? `${assertion.path} matched.` : `${assertion.path} expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actual)}.` };
}

function getPath(body: JsonValue, path: string): JsonValue | undefined {
  return path.slice(2).split(".").reduce<JsonValue | undefined>((value, key) => {
    if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) return undefined;
    return (value as Record<string, JsonValue>)[key];
  }, body);
}

export function verifyFrozenReproduction(plan: ReproductionPlan): VerificationResult {
  const buggy = runPlan(plan, "buggy");
  const corrected = runPlan(plan, "corrected");
  const verified = buggy.status === "failed" && corrected.status === "passed";
  return {
    status: verified ? "verified" : "not-verified",
    evidence: "deterministic-stub",
    reason: verified
      ? "The bounded plan fails on the buggy fixture and passes on the corrected fixture."
      : "The plan did not cleanly distinguish the buggy and corrected fixtures.",
    buggy,
    corrected
  };
}
