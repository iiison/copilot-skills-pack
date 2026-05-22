// T12: readMcpJson + parseJsonc + backupMcpJsonOnce
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseJsonc, readMcpJson, backupMcpJsonOnce } from "../lib/mcp.mjs";

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csp-mcp-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ─── parseJsonc ────────────────────────────────────────────────────────────

test("parseJsonc: plain JSON parses", () => {
  assert.deepEqual(parseJsonc('{"a":1}'), { a: 1 });
});

test("parseJsonc: line comments stripped", () => {
  assert.deepEqual(parseJsonc('{ "a": 1 // comment\n }'), { a: 1 });
});

test("parseJsonc: block comments stripped", () => {
  assert.deepEqual(parseJsonc('{ /* hi */ "a": 1 }'), { a: 1 });
});

test("parseJsonc: trailing commas allowed", () => {
  assert.deepEqual(parseJsonc('{ "a": 1, "b": [1,2,], }'), { a: 1, b: [1, 2] });
});

test("parseJsonc: comment-like content inside strings is preserved", () => {
  assert.deepEqual(parseJsonc('{ "url": "http://x.y/z//path" }'), { url: "http://x.y/z//path" });
  assert.deepEqual(parseJsonc('{ "x": "a/*b*/c" }'), { x: "a/*b*/c" });
});

test("parseJsonc: escaped quotes in strings preserved", () => {
  assert.deepEqual(parseJsonc('{ "msg": "he said \\"hi\\"" }'), { msg: 'he said "hi"' });
});

test("parseJsonc: malformed JSON throws", () => {
  assert.throws(() => parseJsonc("{ not json"), /JSON/i);
});

// ─── readMcpJson ───────────────────────────────────────────────────────────

test("readMcpJson: missing file returns default shape, creates nothing", () => {
  const p = path.join(tmp, "mcp.json");
  const result = readMcpJson(p);
  assert.deepEqual(result, { servers: {} });
  assert.equal(fs.existsSync(p), false, "should not create the file");
});

test("readMcpJson: valid JSON loads", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, '{"servers":{"foo":{"command":"x"}}}');
  assert.deepEqual(readMcpJson(p), { servers: { foo: { command: "x" } } });
});

test("readMcpJson: valid JSONC loads", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, '{\n  // editor-style comment\n  "servers": { "foo": {"command":"x"}, },\n}');
  assert.deepEqual(readMcpJson(p), { servers: { foo: { command: "x" } } });
});

test("readMcpJson: invalid JSON throws with pointer to file; no writes", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, "{ totally bogus");
  const before = fs.readFileSync(p, "utf8");
  assert.throws(() => readMcpJson(p), (err) => err.message.includes(p));
  assert.equal(fs.readFileSync(p, "utf8"), before, "file must be untouched");
});

test("readMcpJson: file without `servers` key gets defaulted (empty object)", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, "{}");
  assert.deepEqual(readMcpJson(p), { servers: {} });
});

// ─── backupMcpJsonOnce ─────────────────────────────────────────────────────

test("backupMcpJsonOnce: creates .bak the first time", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, '{"x":1}');
  backupMcpJsonOnce(p);
  assert.equal(fs.existsSync(p + ".bak.copilot-skills-pack"), true);
});

test("backupMcpJsonOnce: second call does NOT overwrite the .bak", () => {
  const p = path.join(tmp, "mcp.json");
  const bak = p + ".bak.copilot-skills-pack";
  fs.writeFileSync(p, '{"x":1}');
  backupMcpJsonOnce(p);
  fs.writeFileSync(p, '{"x":2}'); // simulate later edit
  backupMcpJsonOnce(p);
  assert.equal(fs.readFileSync(bak, "utf8"), '{"x":1}', "first-version backup preserved");
});

test("backupMcpJsonOnce: missing source file is a no-op", () => {
  const p = path.join(tmp, "missing.json");
  backupMcpJsonOnce(p);
  assert.equal(fs.existsSync(p + ".bak.copilot-skills-pack"), false);
});

test("backupMcpJsonOnce: dry-run mode does not create backup", () => {
  const p = path.join(tmp, "mcp.json");
  fs.writeFileSync(p, '{"x":1}');
  backupMcpJsonOnce(p, { dryRun: true });
  assert.equal(fs.existsSync(p + ".bak.copilot-skills-pack"), false);
});
