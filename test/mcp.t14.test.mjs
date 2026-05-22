// T14: PAT storage helpers (no prompt — the prompt itself is in setup.mjs)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  patEnvFilePath,
  readPatFromEnvFile,
  writePatToEnvFile,
  patResolutionState,
} from "../lib/mcp.mjs";

let home;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "csp-home-"));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

test("patEnvFilePath: <home>/.copilot-skills-pack/.env", () => {
  assert.equal(
    patEnvFilePath(home),
    path.join(home, ".copilot-skills-pack", ".env"),
  );
});

test("readPatFromEnvFile: missing file → null", () => {
  assert.equal(readPatFromEnvFile(home), null);
});

test("readPatFromEnvFile: file present with FIGMA_API_KEY → returns value", () => {
  const p = patEnvFilePath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "FIGMA_API_KEY=tok_abc123\n");
  assert.equal(readPatFromEnvFile(home), "tok_abc123");
});

test("readPatFromEnvFile: empty value → null", () => {
  const p = patEnvFilePath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "FIGMA_API_KEY=\n");
  assert.equal(readPatFromEnvFile(home), null);
});

test("readPatFromEnvFile: ignores unrelated lines", () => {
  const p = patEnvFilePath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "# comment\nOTHER=x\nFIGMA_API_KEY=secret\nMORE=y\n");
  assert.equal(readPatFromEnvFile(home), "secret");
});

test("writePatToEnvFile: creates dir+file with 0600 permissions", () => {
  writePatToEnvFile(home, "tok_xyz");
  const p = patEnvFilePath(home);
  assert.equal(fs.readFileSync(p, "utf8"), "FIGMA_API_KEY=tok_xyz\n");
  if (process.platform !== "win32") {
    const mode = fs.statSync(p).mode & 0o777;
    assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);
    const dirMode = fs.statSync(path.dirname(p)).mode & 0o777;
    assert.equal(dirMode, 0o700, `expected dir 0700, got ${dirMode.toString(8)}`);
  }
});

test("writePatToEnvFile: dry-run does not create the file", () => {
  writePatToEnvFile(home, "tok_xyz", { dryRun: true });
  assert.equal(fs.existsSync(patEnvFilePath(home)), false);
  assert.equal(fs.existsSync(path.join(home, ".copilot-skills-pack")), false);
});

test("writePatToEnvFile: rewrites existing file at 0600", () => {
  writePatToEnvFile(home, "tok_a");
  writePatToEnvFile(home, "tok_b");
  assert.equal(readPatFromEnvFile(home), "tok_b");
});

// patResolutionState (used by setup.mjs to decide whether to prompt)

test("patResolutionState: env var set → uses env, no prompt, no write", () => {
  const s = patResolutionState({ home, envValue: "tok_from_env" });
  assert.deepEqual(s, { source: "env", needsPrompt: false, value: "tok_from_env" });
});

test("patResolutionState: file present → uses file, no prompt", () => {
  fs.mkdirSync(path.join(home, ".copilot-skills-pack"), { recursive: true });
  fs.writeFileSync(patEnvFilePath(home), "FIGMA_API_KEY=tok_from_file\n");
  const s = patResolutionState({ home, envValue: undefined });
  assert.deepEqual(s, { source: "file", needsPrompt: false, value: "tok_from_file" });
});

test("patResolutionState: nothing set → prompt needed", () => {
  const s = patResolutionState({ home, envValue: undefined });
  assert.deepEqual(s, { source: "none", needsPrompt: true, value: null });
});

test("patResolutionState: env var takes precedence over file", () => {
  fs.mkdirSync(path.join(home, ".copilot-skills-pack"), { recursive: true });
  fs.writeFileSync(patEnvFilePath(home), "FIGMA_API_KEY=tok_from_file\n");
  const s = patResolutionState({ home, envValue: "tok_from_env" });
  assert.equal(s.source, "env");
  assert.equal(s.value, "tok_from_env");
});
