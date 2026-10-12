# API Bug Reproducer

A first, local-only version of a bounded API bug reproduction workbench. Paste a report, let the deterministic planner propose a declarative request/assertion plan, run it against a synthetic orders API, and export a fixed Node test plus an execution trace.

## Quick start

Requires Node 22 or newer. There are no runtime dependencies and no secret or model setup is needed.

```sh
npm run demo
npm test
node --test artifacts/reproduction.test.mjs
npm run dev
```

Then open <http://localhost:8787>. The demo writes `artifacts/reproduction.json` and `artifacts/reproduction.test.mjs`.

## What is implemented

- Synthetic `GET /orders` fixture with `status`, `limit`, and `offset`, returning `items`, `total`, `limit`, and `offset`.
- Buggy target paginates before filtering; corrected target filters before paginating. Both calculate the same filtered total.
- Declarative JSON plan validation. Only the configured fixture, `GET /orders`, four statuses, bounded pagination, and a small assertion vocabulary are accepted.
- Deterministic in-process runner with one active synchronous run, cancellation checks, limits on requests, runtime, response size, and trace events.
- Frozen verification: a result is verified only when the buggy target fails and the corrected target passes.
- Deterministic stub planner for tests and local demo. Results explicitly say `deterministic-stub`; they are not evidence of real model quality.
- Optional HTTP model adapter that requires an explicitly supplied HTTPS endpoint and API key, rejects remote plain HTTP and redirects, bounds the provider response, validates returned JSON through the same plan schema, and reports provider/timeout failures. It is not wired into the default server and makes no paid calls in this project.
- Fixed-template Node test export. Model-generated code is never executed.
- Minimal browser UI with downloadable test output.
- Held-out evaluation fixtures kept in `test/evaluation.test.ts`, separate from the development report and fixture implementation.

## Architecture

`src/core/plan.ts` owns the allowlist and plan validation. `src/core/runner.ts` executes plans directly against `src/fixture/orders-api.ts`, so there are no arbitrary URLs, redirects, headers, shell commands, or production endpoints. `src/core/planner.ts` provides the deterministic adapter; `src/core/model-adapter.ts` documents the future provider boundary. `src/server.ts` is a small Node HTTP server serving the static UI and one JSON endpoint.

The runner emits request, response, assertion, completion, and error events. A future provider can only contribute a candidate JSON plan; it must pass the same validator before execution.

## Verification

Run:

```sh
npm run lint
npm run typecheck
npm test
node --test artifacts/reproduction.test.mjs
```

`lint` uses Node's built-in TypeScript strip-types parser for a fast source parse. `typecheck` runs a genuine `tsc --noEmit` check using the authorized TypeScript compiler bundled with the connected environment (and exits as not-run if no compiler is available). The included `tsconfig.json` is ready for a normal local TypeScript installation as well.

The held-out set intentionally demonstrates limitations: the current lexical stub does not infer enough about a boundary offset, cannot establish that an already-correct report is a bug, and does not detect a misleading expected total. These are reported as unverified rather than being presented as successful AI evaluation.

## Remaining gaps

This version has no real external provider evaluation, multi-user isolation, persistence, streaming progress, authentication, arbitrary user fixtures, or production API connectors. The HTTP adapter is implemented and fake-provider tested, but no credentials were configured and no paid model call was made. The UI is a local demo, not a deployed service.
