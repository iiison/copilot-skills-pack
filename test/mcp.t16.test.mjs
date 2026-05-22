// T16: uninstallMcpServers + deletePatFile
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  uninstallMcpServers,
  deletePatFile,
  patEnvFilePath,
  MANAGED_SENTINEL,
} from "../lib/mcp.mjs";

let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), "csp-uninstall-")); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

test("uninstallMcpServers: removes only entries with our sentinel", () => {
  const mcp = {
    servers: {
      "figma-dev-mode": { type: "sse", url: "x", _managedBy: MANAGED_SENTINEL },
      "figma-framelink": { command: "node", _managedBy: MANAGED_SENTINEL },
      "other-mcp": { command: "uvx", args: ["something"] },
      "another": { _managedBy: "someone-else", command: "x" },
    },
  };
  const r = uninstallMcpServers(mcp);
  assert.equal(r.removed.length, 2);
  assert.ok(!mcp.servers["figma-dev-mode"]);
  assert.ok(!mcp.servers["figma-framelink"]);
  assert.ok(mcp.servers["other-mcp"], "unrelated entry preserved");
  assert.ok(mcp.servers["another"], "different sentinel preserved");
});

test("uninstallMcpServers: empty mcp.servers is a safe no-op", () => {
  const mcp = { servers: {} };
  const r = uninstallMcpServers(mcp);
  assert.deepEqual(r.removed, []);
});

test("uninstallMcpServers: managed servers without sentinel are NOT removed", () => {
  // user replaced the entry entirely
  const mcp = {
    servers: {
      "figma-framelink": { command: "bun", args: ["custom"] },
    },
  };
  const r = uninstallMcpServers(mcp);
  assert.deepEqual(r.removed, []);
  assert.equal(mcp.servers["figma-framelink"].command, "bun");
});

// deletePatFile

test("deletePatFile: removes only the .env file, not the directory", () => {
  const p = patEnvFilePath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "FIGMA_API_KEY=x\n");
  deletePatFile(home);
  assert.equal(fs.existsSync(p), false);
  assert.equal(fs.existsSync(path.dirname(p)), true, "parent dir kept");
});

test("deletePatFile: missing file is a no-op", () => {
  assert.doesNotThrow(() => deletePatFile(home));
});

test("deletePatFile: dry-run does not delete", () => {
  const p = patEnvFilePath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "FIGMA_API_KEY=x\n");
  deletePatFile(home, { dryRun: true });
  assert.equal(fs.existsSync(p), true);
});
