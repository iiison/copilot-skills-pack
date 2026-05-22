// T13: buildMcpEntries + registerMcpServers
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMcpEntries, registerMcpServers, MANAGED_SENTINEL } from "../lib/mcp.mjs";

const FRAMELINK_CLI = "/repo/node_modules/figma-developer-mcp/dist/bin.js";

test("buildMcpEntries: figma-dev-mode is SSE on 127.0.0.1:3845", () => {
  const e = buildMcpEntries(FRAMELINK_CLI);
  assert.deepEqual(e["figma-dev-mode"], {
    type: "sse",
    url: "http://127.0.0.1:3845/sse",
    _managedBy: MANAGED_SENTINEL,
  });
});

test("buildMcpEntries: figma-framelink runs node + cli with FIGMA_API_KEY substitution", () => {
  const e = buildMcpEntries(FRAMELINK_CLI);
  assert.deepEqual(e["figma-framelink"], {
    type: "stdio",
    command: "node",
    args: [FRAMELINK_CLI],
    env: { FIGMA_API_KEY: "${env:FIGMA_API_KEY}" },
    _managedBy: MANAGED_SENTINEL,
  });
});

test("registerMcpServers: first run sets both entries", () => {
  const mcp = { servers: {} };
  const r = registerMcpServers(mcp, FRAMELINK_CLI);
  assert.equal(r.changed, true);
  assert.ok(mcp.servers["figma-dev-mode"]);
  assert.ok(mcp.servers["figma-framelink"]);
  assert.equal(mcp.servers["figma-dev-mode"]._managedBy, MANAGED_SENTINEL);
});

test("registerMcpServers: second run is a no-op (deep equal)", () => {
  const mcp = { servers: {} };
  registerMcpServers(mcp, FRAMELINK_CLI);
  const r2 = registerMcpServers(mcp, FRAMELINK_CLI);
  assert.equal(r2.changed, false);
});

test("registerMcpServers: unrelated entries are preserved", () => {
  const mcp = { servers: { "other-mcp": { command: "x" } } };
  registerMcpServers(mcp, FRAMELINK_CLI);
  assert.deepEqual(mcp.servers["other-mcp"], { command: "x" });
});

test("registerMcpServers: hand-edited managed entry triggers conflict (--yes skips)", () => {
  const mcp = { servers: {} };
  registerMcpServers(mcp, FRAMELINK_CLI);
  // user replaces 'node' with 'bun'
  mcp.servers["figma-framelink"].command = "bun";
  const r = registerMcpServers(mcp, FRAMELINK_CLI, { yes: true });
  assert.equal(r.changed, false, "must not silently overwrite user edits");
  assert.equal(mcp.servers["figma-framelink"].command, "bun", "user edit preserved");
  assert.ok(r.conflicts && r.conflicts.length > 0, "conflicts reported");
});

test("registerMcpServers: missing _managedBy field is treated as user-owned (no overwrite)", () => {
  const mcp = {
    servers: {
      "figma-framelink": { type: "stdio", command: "uvx", args: ["other-mcp"] },
    },
  };
  const r = registerMcpServers(mcp, FRAMELINK_CLI, { yes: true });
  assert.equal(mcp.servers["figma-framelink"].command, "uvx", "user entry preserved");
  assert.ok(r.conflicts.includes("figma-framelink"), "conflict reported");
});

test("registerMcpServers: returns the list of server names it owns", () => {
  const mcp = { servers: {} };
  const r = registerMcpServers(mcp, FRAMELINK_CLI);
  assert.deepEqual(r.managed.sort(), ["figma-dev-mode", "figma-framelink"]);
});
