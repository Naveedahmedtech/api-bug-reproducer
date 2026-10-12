import test from "node:test";
import assert from "node:assert/strict";
import { ModelProviderError, OptionalModelPlanner, type ModelFetch } from "../src/core/model-adapter.ts";

const validPlan = {
  version: 1,
  fixture: "synthetic-orders",
  report: "Shipped page is short even though total is four.",
  requests: [{ method: "GET", path: "/orders", query: { status: "shipped", limit: 2, offset: 0 } }],
  assertions: [{ type: "equals", path: "$.total", expected: 4 }]
};

function fakeProvider(body: string, status = 200, inspect?: (input: string, init: Parameters<ModelFetch>[1]) => void): ModelFetch {
  return async (input, init) => {
    inspect?.(input, init);
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
}

test("HTTP adapter validates a provider plan without exposing corrected source or answers", async () => {
  let requestBody = "";
  const planner = new OptionalModelPlanner({
    endpoint: "http://127.0.0.1:9876/fake",
    apiKey: "test-only-key",
    fetchImpl: fakeProvider(JSON.stringify({ plan: validPlan }), 200, (_input, init) => { requestBody = init.body; })
  });
  const result = await planner.propose("status=shipped limit=2 offset=0 returns too few items");
  assert.equal("kind" in result ? result.kind : undefined, undefined);
  assert.equal(JSON.parse(requestBody).contract.fixture, "synthetic-orders");
  assert.doesNotMatch(requestBody.toLowerCase(), /corrected|expected answer|buggy source/);
});

test("adapter reports provider HTTP failures", async () => {
  const planner = new OptionalModelPlanner({ endpoint: "http://localhost/fake", apiKey: "test", fetchImpl: fakeProvider("upstream down", 503) });
  await assert.rejects(planner.propose("a report about orders"), (error: unknown) => error instanceof ModelProviderError && error.causeCode === "http");
});

test("adapter reports malformed provider JSON and plans", async () => {
  const badJson = new OptionalModelPlanner({ endpoint: "http://localhost/fake", apiKey: "test", fetchImpl: fakeProvider("not-json") });
  await assert.rejects(badJson.propose("a report about orders"), (error: unknown) => error instanceof ModelProviderError && error.causeCode === "invalid-response");
  const badPlan = new OptionalModelPlanner({ endpoint: "http://localhost/fake", apiKey: "test", fetchImpl: fakeProvider(JSON.stringify({ plan: { nope: true } })) });
  await assert.rejects(badPlan.propose("a report about orders"), (error: unknown) => error instanceof ModelProviderError && error.causeCode === "invalid-response");
});

test("adapter makes no call when credentials are absent", async () => {
  let called = false;
  const planner = new OptionalModelPlanner({ endpoint: "http://localhost/fake", fetchImpl: async () => { called = true; return { ok: true, status: 200, text: async () => "{}" }; } });
  await assert.rejects(planner.propose("a report about orders"), (error: unknown) => error instanceof ModelProviderError && error.causeCode === "not-configured");
  assert.equal(called, false);
});

test("adapter rejects non-HTTPS remote endpoints", async () => {
  const planner = new OptionalModelPlanner({ endpoint: "http://example.com/provider", apiKey: "test", fetchImpl: fakeProvider(JSON.stringify({ plan: validPlan })) });
  await assert.rejects(planner.propose("a report about orders"), (error: unknown) => error instanceof ModelProviderError && error.causeCode === "invalid-endpoint");
});
