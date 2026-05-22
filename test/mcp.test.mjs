// T11: resolveMcpConfigPath
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { resolveMcpConfigPath } from "../lib/mcp.mjs";

const HOME = os.homedir();
const USER_VSCODE = path.join(HOME, "Library", "Application Support", "Code", "User");

test("resolveMcpConfigPath: vscode returns <userDir>/mcp.json", () => {
  assert.equal(
    resolveMcpConfigPath("vscode", USER_VSCODE),
    path.join(USER_VSCODE, "mcp.json"),
  );
});

test("resolveMcpConfigPath: insiders returns <userDir>/mcp.json", () => {
  const dir = path.join(HOME, "Library", "Application Support", "Code - Insiders", "User");
  assert.equal(resolveMcpConfigPath("insiders", dir), path.join(dir, "mcp.json"));
});

test("resolveMcpConfigPath: vscodium returns <userDir>/mcp.json", () => {
  const dir = path.join(HOME, ".config", "VSCodium", "User");
  assert.equal(resolveMcpConfigPath("vscodium", dir), path.join(dir, "mcp.json"));
});

test("resolveMcpConfigPath: cursor returns ~/.cursor/mcp.json (ignores userDir)", () => {
  assert.equal(
    resolveMcpConfigPath("cursor", "/whatever/path"),
    path.join(HOME, ".cursor", "mcp.json"),
  );
});

test("resolveMcpConfigPath: unknown editor throws", () => {
  assert.throws(
    () => resolveMcpConfigPath("sublime", "/x"),
    /unknown editor/i,
  );
});
