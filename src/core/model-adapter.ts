import { validatePlannerResult } from "./plan.ts";
import type { Planner } from "./planner.ts";
import type { PlannerResult } from "../types.ts";

const MAX_PROVIDER_RESPONSE_BYTES = 64_000;

export class ModelProviderError extends Error {
  readonly causeCode: "not-configured" | "invalid-endpoint" | "http" | "timeout" | "invalid-response";

  constructor(message: string, causeCode: "not-configured" | "invalid-endpoint" | "http" | "timeout" | "invalid-response") {
    super(message);
    this.causeCode = causeCode;
    this.name = "ModelProviderError";
  }
}

export interface ModelFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type ModelFetch = (input: string, init: {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  redirect: "error";
  signal: AbortSignal;
}) => Promise<ModelFetchResponse>;

export interface ModelPlannerOptions {
  endpoint?: string;
  apiKey?: string;
  fetchImpl?: ModelFetch;
  timeoutMs?: number;
}

/**
 * Optional HTTP adapter boundary. It is disabled unless callers provide an
 * endpoint and API key explicitly. The default app never constructs it, so
 * local demos and tests make no paid calls and need no secret.
 */
export class OptionalModelPlanner implements Planner {
  readonly name = "optional-model";
  private readonly endpoint: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: ModelFetch;
  private readonly timeoutMs: number;

  constructor(options: ModelPlannerOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.API_BUG_REPRODUCER_MODEL_ENDPOINT;
    this.apiKey = options.apiKey ?? process.env.API_BUG_REPRODUCER_MODEL_API_KEY;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as ModelFetch);
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 10_000, 100), 30_000);
  }

  async propose(report: string): Promise<PlannerResult> {
    if (!this.endpoint || !this.apiKey) throw new ModelProviderError("Optional model adapter is not configured; no provider call was made.", "not-configured");
    const endpoint = parseEndpoint(this.endpoint);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          report,
          task: "Return one bounded JSON reproduction plan for the configured synthetic orders API.",
          contract: {
            fixture: "synthetic-orders",
            method: "GET",
            path: "/orders",
            query: { status: ["pending", "processing", "shipped", "cancelled"], limit: "integer 1..5", offset: "integer 0..20" },
            assertions: ["equals", "array-length", "contains"]
          }
        }),
        redirect: "error",
        signal: controller.signal
      });
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_PROVIDER_RESPONSE_BYTES) throw new ModelProviderError("Provider response exceeded the 64 KB limit.", "invalid-response");
      if (!response.ok) throw new ModelProviderError(`Provider returned HTTP ${response.status}.`, "http");
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new ModelProviderError("Provider returned invalid JSON.", "invalid-response");
      }
      const candidate = isRecord(parsed) && "plan" in parsed ? parsed.plan : parsed;
      try {
        return validatePlannerResult(candidate);
      } catch (error) {
        throw new ModelProviderError(`Provider returned an invalid reproduction plan: ${error instanceof Error ? error.message : "validation failed"}`, "invalid-response");
      }
    } catch (error) {
      if (error instanceof ModelProviderError) throw error;
      if (controller.signal.aborted) throw new ModelProviderError("Provider request timed out.", "timeout");
      throw new ModelProviderError(`Provider request failed: ${error instanceof Error ? error.message : "unknown error"}`, "http");
    } finally {
      clearTimeout(timer);
    }
  }

  validateExternalPlan(value: unknown): PlannerResult {
    return validatePlannerResult(value);
  }
}

function parseEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ModelProviderError("Provider endpoint must be a valid URL.", "invalid-endpoint");
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new ModelProviderError("Provider endpoint must use HTTPS, except for local fake providers.", "invalid-endpoint");
  if (url.username || url.password) throw new ModelProviderError("Provider endpoint must not contain credentials.", "invalid-endpoint");
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
