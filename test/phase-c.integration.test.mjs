// T28: Phase C integration test — local source + 9 entries install correctly.
//
// Runs the installer in --dry-run --yes against a temporary prompts dir and
// asserts that the 9 Phase C artifacts appear in the planned write list.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SETUP = path.join(ROOT, "setup.mjs");

function runInstaller(extraArgs) {
  const r = spawnSync(
    process.execPath,
    [SETUP, "--dry-run", "--yes", "--skip-mcp", ...extraArgs],
    { cwd: ROOT, encoding: "utf8" }
  );
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

test("Phase C: dry-run installs all 9 local-source artifacts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csp-phasec-"));
  try {
    const { status, stdout, stderr } = runInstaller([`--target-path=${tmp}`]);
    assert.equal(status, 0, `installer exit non-zero. stderr:\n${stderr}`);

    const expected = [
      // alwaysOn → <name>.instructions.md
      "ui-conventions.instructions.md",
      // slashCommands → <name>.prompt.md
      "ui-learn.prompt.md",
      "ui-mcp-status.prompt.md",
      "ui-refine.prompt.md",
      "ui-spec.prompt.md",
      "ui-plan.prompt.md",
      "ui-build.prompt.md",
      "ui-flag.prompt.md",
      // personas → <name>.chatmode.md
      "frontend-craftsman.chatmode.md",
    ];

    for (const f of expected) {
      assert.ok(
        stdout.includes(f),
        `expected installer plan to mention '${f}'. stdout:\n${stdout}`
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("Phase C: local source files exist on disk where the installer expects them", () => {
  const localRoot = path.join(ROOT, "local-skills");

  const skills = [
    "ui-conventions",
    "ui-learn",
    "ui-mcp-status",
    "ui-refine",
    "ui-spec",
    "ui-plan",
    "ui-build",
    "ui-flag",
  ];
  for (const name of skills) {
    const p = path.join(localRoot, "skills", name, "SKILL.md");
    assert.ok(fs.existsSync(p), `missing source file: ${path.relative(ROOT, p)}`);
  }
  const personaPath = path.join(localRoot, "agents", "frontend-craftsman.md");
  assert.ok(fs.existsSync(personaPath), `missing persona: ${path.relative(ROOT, personaPath)}`);
});

test("Phase C: skills.config.json registers the local source and 9 entries", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "skills.config.json"), "utf8"));

  const local = cfg.sources.find((s) => s.id === "local");
  assert.ok(local, "missing sources[].id === 'local'");
  assert.equal(local.type, "local");
  assert.equal(local.path, "local-skills");

  const alwaysOnNames = cfg.alwaysOn.filter((e) => e.source === "local").map((e) => e.name);
  assert.deepEqual(alwaysOnNames, ["ui-conventions"]);

  const slashNames = cfg.slashCommands.filter((e) => e.source === "local").map((e) => e.name).sort();
  assert.deepEqual(
    slashNames,
    ["ui-build", "ui-flag", "ui-learn", "ui-mcp-status", "ui-plan", "ui-refine", "ui-spec"]
  );

  const personas = cfg.personas.filter((e) => e.source === "local").map((e) => e.name);
  assert.deepEqual(personas, ["frontend-craftsman"]);
});
