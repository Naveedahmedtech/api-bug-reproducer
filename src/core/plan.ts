import { FIXTURE_NAME, ORDER_STATUSES, type Assertion, type JsonPrimitive, type PlannerResult, type ReproductionPlan, type ReproductionRequest } from "../types.ts";

const ALLOWED_QUERY_KEYS = new Set(["status", "limit", "offset"]);
const ALLOWED_ASSERTION_TYPES = new Set(["equals", "array-length", "contains"]);

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

export function validatePlannerResult(result: unknown): PlannerResult {
  if (isClarification(result)) return result;
  if (!result || typeof result !== "object") throw new PlanValidationError("Planner output must be an object.");
  const plan = result as Partial<ReproductionPlan>;
  if (plan.version !== 1) throw new PlanValidationError("Only plan version 1 is supported.");
  if (plan.fixture !== FIXTURE_NAME) throw new PlanValidationError("The plan must target the synthetic-orders fixture.");
  if (typeof plan.report !== "string" || plan.report.trim().length < 8 || plan.report.length > 2_000) {
    throw new PlanValidationError("The report must be 8-2,000 characters.");
  }
  if (!Array.isArray(plan.requests) || plan.requests.length < 1 || plan.requests.length > 3) {
    throw new PlanValidationError("A plan must contain 1-3 requests.");
  }
  if (!Array.isArray(plan.assertions) || plan.assertions.length < 1 || plan.assertions.length > 8) {
    throw new PlanValidationError("A plan must contain 1-8 assertions.");
  }
  plan.requests.forEach(validateRequest);
  plan.assertions.forEach(validateAssertion);
  return plan as ReproductionPlan;
}

function validateRequest(value: unknown, index: number): asserts value is ReproductionRequest {
  if (!value || typeof value !== "object") throw new PlanValidationError(`Request ${index + 1} must be an object.`);
  const request = value as Partial<ReproductionRequest> & { query?: Record<string, unknown> };
  if (request.method !== "GET" || request.path !== "/orders") {
    throw new PlanValidationError(`Request ${index + 1} must be GET /orders.`);
  }
  if (!request.query || typeof request.query !== "object") throw new PlanValidationError(`Request ${index + 1} needs query parameters.`);
  for (const key of Object.keys(request.query)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) throw new PlanValidationError(`Query parameter '${key}' is not allowed.`);
  }
  if (request.query.limit !== undefined && (!Number.isInteger(request.query.limit) || request.query.limit < 1 || request.query.limit > 5)) {
    throw new PlanValidationError("limit must be an integer from 1 to 5.");
  }
  if (request.query.offset !== undefined && (!Number.isInteger(request.query.offset) || request.query.offset < 0 || request.query.offset > 20)) {
    throw new PlanValidationError("offset must be an integer from 0 to 20.");
  }
  if (request.query.limit === undefined || request.query.offset === undefined) {
    throw new PlanValidationError("Every request must specify limit and offset.");
  }
  if (request.query.status !== undefined && !ORDER_STATUSES.includes(request.query.status as (typeof ORDER_STATUSES)[number])) {
    throw new PlanValidationError("status is not an allowed order status.");
  }
}

function validateAssertion(value: unknown, index: number): asserts value is Assertion {
  if (!value || typeof value !== "object") throw new PlanValidationError(`Assertion ${index + 1} must be an object.`);
  const assertion = value as Partial<Assertion>;
  if (typeof assertion.type !== "string" || !ALLOWED_ASSERTION_TYPES.has(assertion.type)) {
    throw new PlanValidationError(`Assertion ${index + 1} uses an unsupported type.`);
  }
  if (typeof assertion.path !== "string" || !/^\$\.(items|total|limit|offset)(\.[a-z]+)?$/.test(assertion.path)) {
    throw new PlanValidationError(`Assertion ${index + 1} has a path outside the response schema.`);
  }
  if (assertion.type === "array-length") {
    if (!Number.isInteger(assertion.expected) || (assertion.expected as number) < 0 || (assertion.expected as number) > 5) {
      throw new PlanValidationError("array-length expected must be an integer from 0 to 5.");
    }
  } else if (!isJsonPrimitive(assertion.expected)) {
    throw new PlanValidationError(`Assertion ${index + 1} expected must be a JSON primitive.`);
  }
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isClarification(value: unknown): value is Extract<PlannerResult, { kind: "clarification" }> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.kind === "clarification" && typeof candidate.report === "string" && Array.isArray(candidate.questions) && typeof candidate.reason === "string";
}

export function readJsonPlan(input: string): PlannerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new PlanValidationError("Plan is not valid JSON.");
  }
  return validatePlannerResult(parsed);
}
