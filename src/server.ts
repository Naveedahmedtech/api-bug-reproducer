import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { reproduce } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const html = await readFile(new URL("./ui/index.html", import.meta.url), "utf8");

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") return send(response, 200, html, "text/html; charset=utf-8");
    if (request.method === "POST" && request.url === "/api/reproduce") {
      const payload = await readBody(request, 8_000);
      const parsed = JSON.parse(payload) as { report?: unknown };
      if (typeof parsed.report !== "string") return sendJson(response, 400, { error: "report must be a string" });
      return sendJson(response, 200, await reproduce(parsed.report));
    }
    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "request failed" });
  }
});

server.listen(port, () => console.log(`API Bug Reproducer running at http://localhost:${port}`));

function send(response: ServerResponse, status: number, body: string, contentType: string) {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  send(response, status, JSON.stringify(body, null, 2), "application/json; charset=utf-8");
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  let size = 0;
  const chunks: string[] = [];
  for await (const chunk of request) {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    size += Buffer.byteLength(text, "utf8");
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(text);
  }
  return chunks.join("");
}
