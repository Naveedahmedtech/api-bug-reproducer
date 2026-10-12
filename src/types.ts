export const FIXTURE_NAME = "synthetic-orders" as const;
export const ORDER_STATUSES = ["pending", "processing", "shipped", "cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type TargetVariant = "buggy" | "corrected";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ReproductionRequest {
  method: "GET";
  path: "/orders";
  query: {
    status?: OrderStatus;
    limit: number;
    offset: number;
  };
}

export type Assertion =
  | { type: "equals"; path: string; expected: JsonPrimitive }
  | { type: "array-length"; path: string; expected: number }
  | { type: "contains"; path: string; expected: JsonPrimitive };

export interface ReproductionPlan {
  version: 1;
  fixture: typeof FIXTURE_NAME;
  report: string;
  requests: ReproductionRequest[];
  assertions: Assertion[];
}

export interface Clarification {
  kind: "clarification";
  report: string;
  questions: string[];
  reason: string;
}

export type PlannerResult = ReproductionPlan | Clarification;

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
}

export interface OrdersResponse {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  actual?: JsonValue;
  message: string;
}

export interface TraceEvent {
  sequence: number;
  phase: "request" | "response" | "assertion" | "complete" | "error";
  atMs: number;
  detail: Record<string, JsonValue>;
}

export interface RunResult {
  status: "passed" | "failed" | "cancelled" | "error";
  target: TargetVariant;
  durationMs: number;
  responses: OrdersResponse[];
  assertions: AssertionResult[];
  trace: TraceEvent[];
  error?: string;
}

export interface VerificationResult {
  status: "verified" | "not-verified" | "incomplete";
  evidence: "deterministic-stub";
  reason: string;
  buggy: RunResult;
  corrected: RunResult;
}

export interface ReproductionOutput {
  plan: ReproductionPlan;
  verification: VerificationResult;
  exportedTest: string;
}
