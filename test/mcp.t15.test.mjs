// T15: probeDevMode
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { probeDevMode } from "../lib/mcp.mjs";

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const { port } = server.address();
  try { return await fn(`http://127.0.0.1:${port}/sse`); }
  finally { await new Promise((res) => server.close(res)); }
}

test("probeDevMode: returns reachable=true when port responds", async () => {
  const r = await withServer(
    (req, res) => { res.statusCode = 200; res.end("ok"); },
    (url) => probeDevMode(url, { timeoutMs: 3000 }),
  );
  assert.equal(r.reachable, true);
});

test("probeDevMode: returns reachable=false when nothing listens", async () => {
  // 127.0.0.1:1 is reliably refused
  const r = await probeDevMode("http://127.0.0.1:1/sse", { timeoutMs: 1000 });
  assert.equal(r.reachable, false);
  assert.ok(r.reason, "reason populated");
});

test("probeDevMode: timeout returns reachable=false within budget", async () => {
  // server that accepts the connection but never responds
  const r = await withServer(
    () => { /* hang */ },
    async (url) => {
      const t0 = Date.now();
      const probe = await probeDevMode(url, { timeoutMs: 300 });
      const elapsed = Date.now() - t0;
      assert.ok(elapsed < 1500, `probe should respect timeout, took ${elapsed}ms`);
      return probe;
    },
  );
  assert.equal(r.reachable, false);
});

test("probeDevMode: malformed URL → reachable=false, never throws", async () => {
  const r = await probeDevMode("not-a-url", { timeoutMs: 500 });
  assert.equal(r.reachable, false);
});
