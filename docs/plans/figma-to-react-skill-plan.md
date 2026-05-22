# Figma → React UI Skill Suite — Implementation Plan

> **Status:** Plan v1. Source spec: [docs/specs/figma-to-react-skill-spec.md](../specs/figma-to-react-skill-spec.md).
> **Audience:** Implementing agent or human. Each task is sized to complete in a single agent session. Tasks are independent enough to parallelize where the dependency graph allows.

---

## 1. Plan summary

We are extending `copilot-skills-pack` to ship a **Figma → React UI skill suite** alongside the existing upstream skills. The work splits into four phases executed sequentially. **Phase A** rebuilds the installer foundation so it can serve skills from both the upstream git source and a new local source, without breaking the 20 existing upstream skills. **Phase B** layers MCP-server registration onto the installer so `node setup.mjs` leaves every developer with a working Figma MCP stack (Dev Mode + Framelink fallback). **Phase C** authors the 9 new skill files (persona, always-on instruction, 7 slash commands) in dependency order — `ui-conventions` and `frontend-craftsman` first because everything else references them, then `ui-learn` and `ui-mcp-status` to unblock debugging, then the workflow chain `/ui-refine → /ui-spec → /ui-plan → /ui-build → /ui-flag`. **Phase D** writes user-facing documentation and runs a 3-repo pilot to surface the Open Questions in §10 of the spec. The order is dictated by hard dependencies: installer must work before skills can be installed; skills must exist before docs can describe them; docs must exist before a pilot is reproducible by a third party.

---

## 2. Phases and checkpoints

### Phase A — Installer foundation
**Spec coverage:** §3.1–§3.7, §7 items 1–8.
**Goal:** `setup.mjs` accepts the new multi-source schema, migrates legacy configs in place, and continues to install all 20 upstream skills with zero functional regression.

**Checkpoint A:**
- [ ] `node setup.mjs --dry-run` against the legacy `skills.config.json` produces a migration plan with one backup and a rewrite, no other mutations.
- [ ] `node setup.mjs --yes` then a second `node setup.mjs --yes` is a no-op (no backup overwrite, no rewrite).
- [ ] All 20 existing skills still appear in the user's prompts folder after reload.
- [ ] `node setup.mjs --uninstall` removes only marker-tagged files.
- [ ] A skill with an explicit `source: "local"` referencing a non-existent path produces a clear warning and is skipped (not a crash).

### Phase B — MCP installation
**Spec coverage:** §3.8, §7 items 23–24.
**Goal:** `setup.mjs` registers `figma-dev-mode` (SSE) and `figma-framelink` (stdio) in the editor's `mcp.json`, installs the pinned `figma-developer-mcp` npm package locally, and handles the Personal Access Token with file mode `0600`.

**Checkpoint B:**
- [ ] Clean run on a temp editor user dir produces one `mcp.json.bak.copilot-skills-pack`, both managed entries present, `figma-developer-mcp` in `node_modules/`, `~/.copilot-skills-pack/.env` at `0600` (mocked HOME for the test).
- [ ] Second run is a no-op: no new backup, no PAT prompt, no rewrite.
- [ ] Invalid `mcp.json` halts with a pointer to the file and writes nothing.
- [ ] Dev Mode reachability probe times out cleanly in 3 seconds and does not fail the install when Figma desktop is closed.
- [ ] `--uninstall` removes only the two managed MCP entries, preserves any other entries the user added.
- [ ] PAT is never echoed to stdout or written to any log file.

### Phase C — Skill authoring
**Spec coverage:** §7 items 9–22.
**Goal:** 9 new skill files exist under `local-skills/`, are registered in `skills.config.json` with `source: "local"`, and behave per their §4 acceptance criteria after install.

**Checkpoint C:**
- [ ] After `node setup.mjs --yes` and editor reload, `/` shows the 7 new slash commands and the mode dropdown shows `frontend-craftsman`.
- [ ] Greenfield smoke test (empty repo): `/ui-learn` emits the starter banner, refuses to proceed without `use defaults` or file edit.
- [ ] Mid-maturity smoke test (sample shadcn repo): `/ui-learn` produces a populated guide; `/ui-refine` with a stub Figma URL halts cleanly when MCP is unreachable (since we cannot mock Figma in CI).
- [ ] `/ui-mcp-status` reports both servers' reachability + tool surface; never prints the raw PAT.
- [ ] Persona-mode correction triggers the learning-log prompt exactly once.

### Phase D — Docs + pilot
**Spec coverage:** §7 items 25–26, §9 deliverables.
**Goal:** README, HOW_TO_USE, lifecycle diagram, examples gallery, and troubleshooting page exist. Three pilot repos are run end-to-end and findings logged.

**Checkpoint D:**
- [ ] README has a "Figma → React" section with the §1.2 prerequisites table.
- [ ] HOW_TO_USE.md documents the persona and all 7 `/ui-*` commands.
- [ ] Troubleshooting page covers PAT expired, port 3845 in use, Figma desktop signed out, `figma-developer-mcp` install failure.
- [ ] Pilot run-logs exist for greenfield, mid-maturity, and mature-design-system repos.
- [ ] Each Open Question in spec §10 is either resolved (with the resolution recorded) or explicitly deferred (with rationale).

---

## 3. Task list

#### Task 1: Define multi-source `skills.config.json` schema

**Phase:** A
**Spec sections:** §3.1
**Behavior items covered:** 1
**Depends on:** None
**Size:** XS

**Files touched (expected):**
- `skills.schema.json`

**Description:**
Write the JSON schema reflecting the new `sources[]` + per-skill `source` shape. Allows bare-string entries in `onDemand`, `slashCommands`, `personas` for backward compatibility. Used by editors for autocomplete; not by `setup.mjs` directly.

**Acceptance criteria:**
- [ ] Schema validates both legacy and new configs (round-trip test).
- [ ] Schema disallows unknown top-level keys (closed object).
- [ ] `$schema` URL in `skills.config.json` resolves to this file.

**Verification steps:**
1. `npx ajv-cli validate -s skills.schema.json -d skills.config.json` passes.
2. Manually open `skills.config.json` in VS Code, confirm autocomplete suggests `sources` and rejects an unknown root key.

**Risks / unknowns:**
- None significant.

---

#### Task 2: Implement legacy-config migration in `setup.mjs`

**Phase:** A
**Spec sections:** §3.2, §3.7 ACs 1–2
**Behavior items covered:** 2
**Depends on:** Task 1
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add a `migrateConfigIfLegacy()` step before `loadConfig()` returns. Detect legacy shape (singular `source` object OR any bare-string entries in `onDemand`/`slashCommands`/`personas`). Write `skills.config.json.bak.copilot-skills-pack` once, rewrite in place to the new schema, log the migration. Re-runs against migrated configs must be no-ops.

**Acceptance criteria:**
- [ ] First run on the current legacy `skills.config.json` produces exactly one backup and rewrites the file.
- [ ] Second run does not touch the backup or the file.
- [ ] Bare-string entries become `{ name, source: "upstream" }` objects.
- [ ] Singular `source` becomes `sources: [{ id: "upstream", type: "git", ...oldSource }]`.

**Verification steps:**
1. Copy `skills.config.json` to a temp fixture, run the migration in isolation (`node -e "require('./setup.mjs').migrate(...)"` or test harness).
2. Diff the migrated file against the expected shape.
3. Re-run; confirm `stat -f %m` is unchanged.

**Risks / unknowns:**
- JSONC comments are not present in the current config but could appear in the future; document that the migration uses `JSON.parse` and will reject comments.

---

#### Task 3: Implement multi-source `resolveSourceDir()`

**Phase:** A
**Spec sections:** §3.3
**Behavior items covered:** 3, 4
**Depends on:** Task 2
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `resolveSourceDir(sources, sourceId)` returning the on-disk directory for a source. For `type: "git"`, return `.cache/sources/<id>/`. For `type: "local"`, return `path.resolve(ROOT, src.path)`. Throw `Unknown source id: <id>` on missing source. Include a one-time rename of `.cache/agent-skills/` → `.cache/sources/upstream/` (idempotent — guarded by `fs.existsSync` of both paths).

**Acceptance criteria:**
- [ ] `resolveSourceDir(..., "upstream")` returns `.cache/sources/upstream/` after migration.
- [ ] `resolveSourceDir(..., "local")` returns the absolute path to `./local-skills/`.
- [ ] Unknown id throws with the documented message.
- [ ] Legacy cache directory is renamed once; subsequent runs see only the new path.

**Verification steps:**
1. Unit-test the function with both fixture sources.
2. On a temp checkout with `.cache/agent-skills/` present, run the install once; verify rename and that no `.cache/agent-skills/` remains.

**Risks / unknowns:**
- Symlinked cache directories on Linux. Use `fs.realpathSync` cautiously to avoid following hostile links.

---

#### Task 4: Extend `syncSourceRepo()` to iterate `sources[]`

**Phase:** A
**Spec sections:** §3.3
**Behavior items covered:** 3
**Depends on:** Task 3
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Replace the single-source `syncSourceRepo(config.source)` call with a loop over `config.sources` that runs only for `type: "git"` entries. `type: "local"` sources skip the clone/fetch. Each git source caches under its own `.cache/sources/<id>/`.

**Acceptance criteria:**
- [ ] Two git sources clone into two separate cache subdirectories.
- [ ] A local source does not touch `.cache/`.
- [ ] Existing single-`upstream` config continues to work identically after migration.

**Verification steps:**
1. Synthesize a 2-git-source fixture; run; confirm both cache dirs exist with `.git/`.
2. With local-only sources, confirm `.cache/sources/` is empty.

**Risks / unknowns:**
- Network failures on one source should not prevent others from installing. Decide: continue-on-error per source vs fail-fast. Default to fail-fast for v1 (mirrors current behavior).

---

#### Task 5: Thread `source` through `installInstructions` and `installPrompts`

**Phase:** A
**Spec sections:** §3.4, §3.5
**Behavior items covered:** 5, 6
**Depends on:** Task 3
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Change both functions to accept `(items, targetDir, sources)` and resolve each item's source via `resolveSourceDir`. Read `SKILL.md` from `<sourceDir>/skills/<name>/SKILL.md`. Missing files log warnings and skip (no fatal error).

**Acceptance criteria:**
- [ ] Always-on and on-demand entries with `source: "upstream"` continue to install from the upstream cache.
- [ ] Entries with `source: "local"` install from `./local-skills/skills/<name>/SKILL.md`.
- [ ] Missing source file produces a warning and the run continues.

**Verification steps:**
1. Add a single fake `local-skills/skills/test-skill/SKILL.md` and an always-on entry referencing it; run; confirm the installed file appears in the prompts dir.
2. Reference a non-existent local skill; run; confirm warning + zero installed files for that entry.

**Risks / unknowns:**
- Path-separator differences on Windows. Use `path.join`, never string concatenation with `/`.

---

#### Task 6: Thread `source` through `installSlashCommands` and `installPersonas`

**Phase:** A
**Spec sections:** §3.4
**Behavior items covered:** 5, 6
**Depends on:** Task 5
**Size:** M

**Files touched (expected):**
- `setup.mjs`

**Description:**
Same threading as Task 5, with the divergent file-resolution rule for slash commands: `local` sources read `<sourceDir>/skills/<name>/SKILL.md`; `git` sources keep the existing `.claude/commands/<name>.md` then `.gemini/commands/<name>.md` fallback chain. Personas read `<sourceDir>/agents/<name>.md` regardless of source type.

**Acceptance criteria:**
- [ ] Upstream slash commands continue to install from `.claude/commands/` or `.gemini/commands/`.
- [ ] Local slash commands install from `<sourceDir>/skills/<name>/SKILL.md`.
- [ ] Upstream and local personas both install from `<sourceDir>/agents/<name>.md`.
- [ ] Missing files warn and skip.

**Verification steps:**
1. Run against the current config (all upstream): confirm all 7 slash commands and 3 personas install identically to the pre-change baseline.
2. Add a fake local slash command + persona; confirm both install.

**Risks / unknowns:**
- Divergent path conventions per source type are easy to get wrong. Add a small lookup table in code rather than nested `if`s.

---

#### Task 7: Implement name-collision warning + later-wins ordering

**Phase:** A
**Spec sections:** §3.5
**Behavior items covered:** 7
**Depends on:** Task 6
**Size:** XS

**Files touched (expected):**
- `setup.mjs`

**Description:**
For each array (alwaysOn, onDemand, slashCommands, personas), detect duplicate `name` across sources. Emit `⚠ <kind> '<name>' defined by both '<src-a>' and '<src-b>'; using '<src-b>' (path: ...)`. The later entry wins because the install loop processes entries in array order and the last write overwrites the earlier file.

**Acceptance criteria:**
- [ ] Two entries with the same name in the same array produce exactly one warning naming both sources.
- [ ] The file on disk after install matches the later entry's content.
- [ ] No collision detection across arrays (e.g., an `alwaysOn` and a `slashCommand` may share a name).

**Verification steps:**
1. Fixture with two `slashCommands` named `build`, one upstream and one local; run; confirm warning text and that the file on disk has the local content.

**Risks / unknowns:**
- Case sensitivity. Use exact string match for v1 (deferred normalization).

---

#### Task 8: Update `printNextSteps`, `--help`, and CLI option docs

**Phase:** A
**Spec sections:** §3.6 (unchanged), §7 item 8
**Behavior items covered:** 8
**Depends on:** Task 6
**Size:** XS

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `/ui-*` commands and `frontend-craftsman` persona to `printNextSteps`. Add a short note that the MCP installation runs as a separate step (Phase B). Update `--help` to mention `--uninstall` now also handles `mcp.json` cleanup (forward-looking text — actual behavior lands in B7).

**Acceptance criteria:**
- [ ] `node setup.mjs --help` lists the new section.
- [ ] `node setup.mjs --yes` final output mentions `frontend-craftsman` and the 7 `/ui-*` commands by name.

**Verification steps:**
1. Capture stdout of a `--dry-run` and grep for the new strings.

**Risks / unknowns:**
- None.

---

#### Task 9: Migrate `skills.config.json` to multi-source schema (committed)

**Phase:** A
**Spec sections:** §3.1
**Behavior items covered:** (housekeeping; supports later items 18–19)
**Depends on:** Task 2 (the migration logic must exist and be tested first, so this commit is verifiable as a no-op for users)
**Size:** XS

**Files touched (expected):**
- `skills.config.json`

**Description:**
Hand-write the migrated config: add `sources: [upstream, local]`, convert all bare strings to `{ name, source: "upstream" }`. This is the same output `migrateConfigIfLegacy()` would produce; committing it removes the migration warning from every user's first post-upgrade run.

**Acceptance criteria:**
- [ ] Running `node setup.mjs --yes` on the committed config produces zero migration logs and zero `.bak` files.
- [ ] All 20 upstream skills still install.
- [ ] Re-runs are no-ops.

**Verification steps:**
1. `node setup.mjs --dry-run`; confirm no migration message.
2. `node setup.mjs --yes` twice; confirm second run logs no file writes.

**Risks / unknowns:**
- Existing forks that re-derive the config will see one-time migration. Acceptable — they're already running migration code.

---

#### Task 10: Pin `figma-developer-mcp` in `package.json`

**Phase:** B
**Spec sections:** §3.8.1 step 5
**Behavior items covered:** 23
**Depends on:** None (parallel with late Phase A)
**Size:** XS

**Files touched (expected):**
- `package.json` (new file)
- `package-lock.json` (new file)
- `.gitignore` (add `node_modules/` if missing)

**Description:**
Create `package.json` with `{ "name": "copilot-skills-pack", "private": true }` and `dependencies: { "figma-developer-mcp": "<pinned-version>" }`. Run `npm install` once to generate the lockfile. Do not add other dependencies.

**Acceptance criteria:**
- [ ] `npm install` succeeds offline-after-first-run (lockfile committed).
- [ ] `node_modules/figma-developer-mcp/package.json` exists and matches the pinned version.
- [ ] `.gitignore` excludes `node_modules/`.

**Verification steps:**
1. `rm -rf node_modules/ && npm ci`; confirm exit code 0 and target package present.
2. `node -e "require.resolve('figma-developer-mcp')"` succeeds.

**Risks / unknowns:**
- Pinned version may have known CVEs at install time. Check `npm audit --production` before committing. Document the chosen version in the commit message.

---

#### Task 11: Implement MCP config-path resolver per editor target

**Phase:** B
**Spec sections:** §3.8.1 step 1
**Behavior items covered:** 24
**Depends on:** None
**Size:** XS

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `resolveMcpConfigPath(editorId, userDir)` returning the absolute path to `mcp.json`. VS Code / Insiders / VSCodium: `<userDir>/mcp.json`. Cursor: `~/.cursor/mcp.json`. Use the existing `discoverEditors()` output.

**Acceptance criteria:**
- [ ] Returns the correct path for each of the four supported editors.
- [ ] Throws a clear error for unknown editor ids.

**Verification steps:**
1. Unit-test against synthetic editor records for each id.

**Risks / unknowns:**
- Cursor's config path has changed historically. Document the assumption in a code comment and link to the spec section.

---

#### Task 12: Read, parse, and back up `mcp.json` (JSONC-tolerant)

**Phase:** B
**Spec sections:** §3.8.1 steps 2–3
**Behavior items covered:** 24
**Depends on:** Task 11
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `readMcpJson(path)` that handles: missing file (return `{ servers: {} }`), present-and-parseable JSONC (strip comments + trailing commas, parse), present-and-unparseable (halt with the spec's documented message — pointer to file, no writes). Add `backupMcpJsonOnce(path)` mirroring `backupOnce`.

**Acceptance criteria:**
- [ ] Missing file returns the default shape; no file is created at this stage.
- [ ] Valid JSON parses correctly.
- [ ] Valid JSONC (comments + trailing commas) parses correctly.
- [ ] Invalid JSONC throws with a clear pointer; no file is written.
- [ ] Backup file `mcp.json.bak.copilot-skills-pack` is created at most once per machine.

**Verification steps:**
1. Unit-test all four cases with fixtures.
2. Run twice against a valid file; confirm only one backup exists.

**Risks / unknowns:**
- Choice of JSONC parser. Use a tiny inline strip-comments implementation rather than adding a dependency (consistent with the current installer's zero-dep style).

---

#### Task 13: Register `figma-dev-mode` and `figma-framelink` entries in `mcp.json`

**Phase:** B
**Spec sections:** §3.8.1 steps 4, 7
**Behavior items covered:** 24
**Depends on:** Task 12
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `registerMcpServers(mcpJson)`. Insert/update two server entries:

- `figma-dev-mode`: `{ type: "sse", url: "http://127.0.0.1:3845/sse" }`.
- `figma-framelink`: `{ type: "stdio", command: "node", args: ["<abs-path-to-node_modules>/figma-developer-mcp/dist/cli.js"], env: { "FIGMA_API_KEY": "${env:FIGMA_API_KEY}" } }`.

Both entries are marked with a sentinel field `_managedBy: "copilot-skills-pack"` so `--uninstall` can identify them without ambiguity (this is the JSON analogue of the existing markdown marker comment). The presence check before writing must use exact deep-equal on the expected entry; only write if mismatched.

**Acceptance criteria:**
- [ ] After first run, both entries exist with the expected shape and the sentinel.
- [ ] A second run does not modify `mcp.json` (deep-equal match → skip write).
- [ ] If the user hand-edits a managed entry, the installer warns and asks before overwriting (interactive) or skips with a warning (in `--yes` mode).
- [ ] Other entries in `mcp.json` are preserved untouched.

**Verification steps:**
1. Run against an empty `mcp.json`; verify entries.
2. Run again; verify no diff.
3. Run against an `mcp.json` containing an unrelated server; verify it survives.
4. Hand-edit `figma-framelink.command` to `bun`; run in `--yes`; verify the warning and that the file is unchanged.

**Risks / unknowns:**
- Exact path to `figma-developer-mcp` CLI binary. Resolve dynamically via `require.resolve` rather than hardcoding `dist/cli.js` if the package name suggests it.

---

#### Task 14: Implement PAT prompt + `~/.copilot-skills-pack/.env` write

**Phase:** B
**Spec sections:** §3.8.1 step 6, §3.8.4 ACs
**Behavior items covered:** 24
**Depends on:** Task 13
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add `ensurePatConfigured()`. Order of resolution:
1. If `process.env.FIGMA_API_KEY` is set, skip prompt and skip env-file write.
2. Else if `~/.copilot-skills-pack/.env` exists with a non-empty `FIGMA_API_KEY` line, skip prompt.
3. Else prompt: *"Enter Figma Personal Access Token (input hidden; press Enter to skip):"*. Use `readline` with `terminal: true` and a manual mute on the input stream so the token is not echoed.
4. Create `~/.copilot-skills-pack/` directory with mode `0700`. Write `.env` with `FIGMA_API_KEY=<value>\n` and `fs.chmodSync(file, 0o600)`.
5. Never log the token. Logging may say `"PAT stored (length: <n>)"` for diagnostics — length only.

**Acceptance criteria:**
- [ ] First run with no PAT prompts; provided value written to env file at mode `0600`.
- [ ] Second run is no-op (no prompt, no rewrite).
- [ ] `FIGMA_API_KEY` in `process.env` short-circuits the prompt.
- [ ] PAT never appears in stdout, in any log file, or in `mcp.json`.
- [ ] `--dry-run` skips the prompt and the file write but prints the documented intent.

**Verification steps:**
1. Run on a clean HOME (mocked via `$HOME=/tmp/test-home`); enter a known PAT; `cat /tmp/test-home/.copilot-skills-pack/.env` shows it; `stat -f %Mp%Lp` shows `600`.
2. Re-run; confirm no prompt.
3. Set `FIGMA_API_KEY=foo` and re-run on a fresh HOME; confirm no prompt and no file written.
4. Run with `--dry-run`; confirm no file changes and no prompt.

**Risks / unknowns:**
- Hidden input on Windows differs from Unix. Document as a known limitation: input may be visible in `cmd.exe`. Acceptable for v1 since the token is short-lived and user-revokable.
- See Open Question #5 in spec §10: editor-spawned MCP processes may not inherit shell env. This task only stores the PAT — propagation to the spawned process is addressed by Task 13's env reference + a `printNextSteps` snippet.

---

#### Task 15: Dev Mode reachability probe (non-fatal)

**Phase:** B
**Spec sections:** §3.8.1 step 8
**Behavior items covered:** 24
**Depends on:** Task 13
**Size:** XS

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add a 3-second `GET http://127.0.0.1:3845/sse` (or equivalent HEAD) using Node's built-in `http` module. On success: log `✓ Figma Dev Mode MCP reachable`. On failure: log a yellow warning with the two enable steps. The install must continue regardless of probe outcome.

**Acceptance criteria:**
- [ ] Probe completes within 3 seconds even when the port is unresponsive.
- [ ] Install exit code is 0 even when the probe fails.
- [ ] On `--dry-run`, the probe still runs (it's read-only).

**Verification steps:**
1. With nothing listening on 3845: run; confirm warning + exit 0.
2. Run a `nc -l 3845` listener that accepts the connection; confirm the success path is taken (close listener; do not require a real SSE response).

**Risks / unknowns:**
- Some CI environments may have something else on port 3845. Document the probe's purpose so CI failures are read correctly.

---

#### Task 16: Extend `--uninstall` to remove MCP entries

**Phase:** B
**Spec sections:** §3.8.3
**Behavior items covered:** 24
**Depends on:** Tasks 13, 14
**Size:** S

**Files touched (expected):**
- `setup.mjs`

**Description:**
Add an `uninstallMcp(mcpPath)` step. Remove any server whose `_managedBy === "copilot-skills-pack"`. Prompt: *"Also delete the PAT at `~/.copilot-skills-pack/.env`? (y/N)"*. Default no. In `--yes` mode, default no (PAT is precious; do not destroy without explicit confirmation).

**Acceptance criteria:**
- [ ] After uninstall, neither `figma-dev-mode` nor `figma-framelink` exists in `mcp.json`.
- [ ] Other server entries are unchanged.
- [ ] PAT file is kept by default.
- [ ] Answering `y` to the prompt removes only the env file, not the directory.

**Verification steps:**
1. Install then uninstall on a fixture with an unrelated server; diff `mcp.json` to confirm only managed entries removed.
2. Uninstall with answer `y`; confirm `.env` is removed and the parent dir remains.

**Risks / unknowns:**
- If a user adds the sentinel field to a non-managed entry, we'd remove it. Document as a known limitation; the sentinel is also a marker, not a contract.

---

#### Task 17: Installer help text + `--dry-run` parity for MCP mutations

**Phase:** B
**Spec sections:** §3.8.4 ACs
**Behavior items covered:** 24 (cross-cutting)
**Depends on:** Tasks 13, 14, 16
**Size:** XS

**Files touched (expected):**
- `setup.mjs`

**Description:**
Audit every MCP mutation (Tasks 13, 14, 16) to confirm `--dry-run` produces a log-only path with no file or `process.env` mutation. Update `--help` to mention the MCP install/uninstall scope.

**Acceptance criteria:**
- [ ] `node setup.mjs --dry-run` against a clean machine produces zero file writes, zero npm calls, zero `.env` writes — only diagnostic logs prefixed `[dry-run]`.
- [ ] `--help` lists the MCP installation as part of the install flow.

**Verification steps:**
1. Strace or `node --trace-warnings setup.mjs --dry-run` to confirm no `fs.writeFile`, `fs.mkdir`, or `execSync('npm', ...)` calls.

**Risks / unknowns:**
- The `npm install` step in Task 10 is run once at developer-setup time, not on every `setup.mjs` invocation. Confirm this in the implementation — `setup.mjs` should *check* `node_modules/figma-developer-mcp/package.json` exists, not run npm itself, unless missing and in non-dry-run mode.

---

#### Task 18: Create `local-skills/` directory layout

**Phase:** C
**Spec sections:** §2
**Behavior items covered:** 9
**Depends on:** Task 6 (the installer must be able to consume local sources)
**Size:** XS

**Files touched (expected):**
- `local-skills/agents/.gitkeep`
- `local-skills/skills/.gitkeep`
- `local-skills/README.md`

**Description:**
Create the directory tree per spec §2. Add a short `local-skills/README.md` explaining that these files are authored locally and installed via `source: "local"`.

**Acceptance criteria:**
- [ ] Directories exist and are tracked (via `.gitkeep`).
- [ ] README mentions the spec section and the source convention.

**Verification steps:**
1. `git ls-files local-skills/` shows the two `.gitkeep` files.

**Risks / unknowns:**
- None.

---

#### Task 19: Author `ui-conventions` always-on instruction

**Phase:** C
**Spec sections:** §4.2
**Behavior items covered:** 11
**Depends on:** Task 18
**Size:** S

**Files touched (expected):**
- `local-skills/skills/ui-conventions/SKILL.md`

**Description:**
Write the always-on instruction body covering the five rules in §4.2 (read-first, token discipline, component reuse, learnings respect, out-of-scope guardrail). No frontmatter — installer adds it per `skills.config.json`.

**Acceptance criteria:**
- [ ] File exists; passes the §4.2 acceptance criteria after install.
- [ ] Body explicitly mentions reading `docs/ui/repo-ui-guide.md` and the recommendation to run `/ui-learn` when absent.

**Verification steps:**
1. After Phase A is merged and this file is registered (Task 29), `node setup.mjs --yes` produces `ui-conventions.instructions.md` in the prompts dir with the spec's body content.
2. Open a `.tsx` file in the workspace; ask the agent to write a component without a guide present; confirm it recommends `/ui-learn`.

**Risks / unknowns:**
- Body length affects context cost. Keep under ~300 tokens.

---

#### Task 20: Author `frontend-craftsman` persona (with session-state appendix)

**Phase:** C
**Spec sections:** §4.1, §6.2 (appendix)
**Behavior items covered:** 10, 21
**Depends on:** Task 18
**Size:** M

**Files touched (expected):**
- `local-skills/agents/frontend-craftsman.md`

**Description:**
Author the persona per §4.1: identity statement, first-turn behavior, slash-command recommendation table, mid-correction learning rule (verbatim), discoverability hint, out-of-scope guardrails. Include the §6.2 session-state schema and read/write contract as a reference appendix so every `/ui-*` chat under this persona behaves consistently (covers item 21).

**Acceptance criteria:**
- [ ] Passes §4.1 ACs after install.
- [ ] Appendix reproduces §6.2 schema byte-for-byte.
- [ ] Refuses to generate Vue/Svelte/MUI with the documented refusal message.

**Verification steps:**
1. Install; reload; switch to `frontend-craftsman` mode in a fresh chat; verify first-turn behavior with no guide present.
2. Paste a Figma URL; confirm the persona recommends `/ui-refine` but does not execute it.
3. Ask for a Vue component; confirm the refusal text matches.

**Risks / unknowns:**
- Mid-correction detection is LLM-heuristic. Document the detection signals (per §4.1 item 4) inside the persona body so behavior is reproducible across sessions.

---

#### Task 21: Author `/ui-learn` slash command (with guide template appendix)

**Phase:** C
**Spec sections:** §4.3, §6.1, §6.1.1
**Behavior items covered:** 12, 20
**Depends on:** Task 19 (references conventions), Task 20 (references persona state contract)
**Size:** M

**Files touched (expected):**
- `local-skills/skills/ui-learn/SKILL.md`

**Description:**
Author per §4.3: scan phase, question phase, greenfield branch, write phase, closing prompt. Include §6.1 guide template and §6.1.1 greenfield banner as appendices so the agent emits the file byte-for-byte (covers item 20).

**Acceptance criteria:**
- [ ] Passes §4.3 ACs after install.
- [ ] Appendix reproduces §6.1 + §6.1.1 templates exactly.
- [ ] Asks the dev before appending to `.gitignore`.

**Verification steps:**
1. Greenfield fixture (empty dir): `/ui-learn` emits starter banner; sets `starterGuideAccepted = false`; refuses to proceed.
2. Mid-maturity fixture (shadcn + tokens.ts): `/ui-learn` asks ≤6 questions, writes guide with populated Inventory and Token Map.

**Risks / unknowns:**
- Scan-phase question count depends on signal strength. The spec says "4–6 targeted questions"; instruct the agent to skip questions whose answers are unambiguous.

---

#### Task 22: Author `/ui-mcp-status` slash command

**Phase:** C
**Spec sections:** §4.9
**Behavior items covered:** 18
**Depends on:** Task 20 (state contract)
**Size:** S

**Files touched (expected):**
- `local-skills/skills/ui-mcp-status/SKILL.md`

**Description:**
Author per §4.9: probe both servers, report active source + tool surface, never print raw PAT (only last 4 characters), no halt on both-unreachable, update `state.lastMcpProbeAt`. Authored early in Phase C so MCP debugging is available while authoring the remaining commands.

**Acceptance criteria:**
- [ ] Passes §4.9 ACs after install.
- [ ] Verifiable by running `/ui-mcp-status` in a fresh chat: produces the documented report shape.
- [ ] PAT redaction is enforced via instruction language; reviewers spot-check the output never contains a full token.

**Verification steps:**
1. Install; reload; run `/ui-mcp-status` with Dev Mode unreachable; confirm both-down report + remediation.
2. Run with `FIGMA_API_KEY=abcd1234efgh5678a1b2`; confirm output shows `…a1b2` only.

**Risks / unknowns:**
- The agent must call the MCP `list-tools` (or equivalent) operation. Per Open Question #1, exact MCP semantics vary; document a discovery step inside the skill body.

---

#### Task 23: Author `/ui-refine` (with refinement template appendix)

**Phase:** C
**Spec sections:** §4.4, §6.4, §6.5
**Behavior items covered:** 13
**Depends on:** Tasks 19, 20, 21
**Size:** M

**Files touched (expected):**
- `local-skills/skills/ui-refine/SKILL.md`

**Description:**
Author per §4.4: fetch, detection, breakdown, re-skin branch, close. Include §6.4 refinement template and §6.5 slug rules as appendices.

**Acceptance criteria:**
- [ ] Passes §4.4 ACs after install.
- [ ] Halts cleanly when both MCP servers are unreachable, pointing at `/ui-mcp-status`.
- [ ] In re-skin mode, builds a draft Preserve/Replace contract.

**Verification steps:**
1. With no Figma MCP reachable: `/ui-refine <url>` halts with the documented message.
2. (Manual, on a real machine with Dev Mode running) Refine a sample frame from-scratch; confirm artifact at `docs/ui/refinements/<slug>.md`.
3. Refine with `--target=<existing-file>`; confirm draft contract section appears.

**Risks / unknowns:**
- The Figma MCP tool surface (Open Q #1) affects fetch fidelity. Document the discovery step explicitly.

---

#### Task 24: Author `/ui-spec` (with Preserve/Replace contract template appendix)

**Phase:** C
**Spec sections:** §4.5, §6.3, §6.3.1, §6.3.2
**Behavior items covered:** 14, 22
**Depends on:** Task 23
**Size:** M

**Files touched (expected):**
- `local-skills/skills/ui-spec/SKILL.md`

**Description:**
Author per §4.5: per-component specs, re-skin contract promotion, self-check enumeration, dev approval gate. Include §6.3 contract template + §6.3.1 approval semantics + §6.3.2 enumeration rule as appendices (covers item 22).

**Acceptance criteria:**
- [ ] Passes §4.5 ACs after install.
- [ ] Self-check enumeration halts if any statement is unaccounted for.
- [ ] Does not proceed without explicit `approve` keyword from the dev.

**Verification steps:**
1. Continue from Task 23's re-skin refinement; run `/ui-spec`; confirm self-check table is produced and approval is required before proceeding.

**Risks / unknowns:**
- LLM-enforced enumeration is the central honest constraint (§8.4). The mitigation is the explicit table; verify the agent emits the table, not a summary.

---

#### Task 25: Author `/ui-plan`

**Phase:** C
**Spec sections:** §4.6
**Behavior items covered:** 15
**Depends on:** Task 24
**Size:** S

**Files touched (expected):**
- `local-skills/skills/ui-plan/SKILL.md`

**Description:**
Author per §4.6: topologically ordered task list, each task with file path, reuse imports, new primitives, build order, acceptance criteria, re-skin annotation if applicable.

**Acceptance criteria:**
- [ ] Passes §4.6 ACs after install.
- [ ] Detects build-order cycles and halts.

**Verification steps:**
1. With a Task-24 spec in place: `/ui-plan` produces ordered tasks with the documented sections; saves to `docs/ui/plans/<slug>.md`.

**Risks / unknowns:**
- None significant.

---

#### Task 26: Author `/ui-build`

**Phase:** C
**Spec sections:** §4.7
**Behavior items covered:** 16
**Depends on:** Task 25
**Size:** M

**Files touched (expected):**
- `local-skills/skills/ui-build/SKILL.md`

**Description:**
Author per §4.7: mandatory contract gate (re-skin), first-run preference checks (`generateTests === null`), per-task loop with pre/post self-checks, `--task=<N>` validation (out-of-range and already-built halts), commit prompts. Honor §8.4 honest constraints.

**Acceptance criteria:**
- [ ] Passes §4.7 ACs after install, including the two new `--task=<N>` ACs.
- [ ] Halts on contract violation; never writes a file with a PRESERVE-range modification.

**Verification steps:**
1. Re-skin scenario with a deliberately-introduced PRESERVE violation (e.g., ask the agent to "also update the imports while you're at it"); confirm halt with the spec's violation message.
2. `/ui-build --task=99`; confirm out-of-range halt.
3. `/ui-build --task=1` after task 1 has been built; confirm already-built halt; with `--force`, confirm rebuild proceeds.

**Risks / unknowns:**
- The pre/post self-check is LLM reasoning over text. The verification depends on the test scenario being adversarial enough; document the test prompts in the skill's behavioral example.

---

#### Task 27: Author `/ui-flag`

**Phase:** C
**Spec sections:** §4.8
**Behavior items covered:** 17
**Depends on:** Task 19 (references conventions)
**Size:** S

**Files touched (expected):**
- `local-skills/skills/ui-flag/SKILL.md`

**Description:**
Author per §4.8: fetch frame, compare against guide, severity-label findings (Critical/Important/Nit), read-only.

**Acceptance criteria:**
- [ ] Passes §4.8 ACs after install.
- [ ] Writes no files; touches no session state.

**Verification steps:**
1. (Manual, with Dev Mode running) `/ui-flag <url>` on a sample frame; confirm severity-labeled output and zero file system changes (verified via `git status`).

**Risks / unknowns:**
- Overlap with always-on `code-review-and-quality` severity labels (Open Q #3). Document explicitly that `/ui-flag` is additive (only UI deviations).

---

#### Task 28: Register the 9 new entries in `skills.config.json`

**Phase:** C
**Spec sections:** §3.1 (multi-source schema usage)
**Behavior items covered:** 19
**Depends on:** Tasks 19, 20, 21, 22, 23, 24, 25, 26, 27
**Size:** XS

**Files touched (expected):**
- `skills.config.json`

**Description:**
Add the 9 entries with `source: "local"`:
- `alwaysOn`: `ui-conventions` with `applyTo: "**/*.{tsx,ts,css}"`.
- `personas`: `frontend-craftsman`.
- `slashCommands`: `ui-learn`, `ui-refine`, `ui-spec`, `ui-plan`, `ui-build`, `ui-flag`, `ui-mcp-status`.

**Acceptance criteria:**
- [ ] After `node setup.mjs --yes` + reload, all 9 artifacts appear in the prompts folder.
- [ ] `/` picker in chat shows all 7 new commands.
- [ ] Mode dropdown shows `frontend-craftsman`.

**Verification steps:**
1. `node setup.mjs --dry-run` lists 9 new files to write.
2. `node setup.mjs --yes`; ls the prompts dir; reload editor; verify in chat UI.

**Risks / unknowns:**
- Schema validation must pass (Task 1's schema). Run `ajv` validation as part of CI.

---

#### Task 29: Greenfield smoke test fixture and script

**Phase:** C
**Spec sections:** Checkpoint C
**Behavior items covered:** (verification cross-cut)
**Depends on:** Task 28
**Size:** S

**Files touched (expected):**
- `tests/fixtures/greenfield-repo/` (empty package.json)
- `tests/smoke/greenfield.md` (a chat transcript template)

**Description:**
Create a minimal greenfield fixture and a documented manual smoke test sequence. Tests are agent-driven, not automated — the artifact is the documented procedure plus the fixture.

**Acceptance criteria:**
- [ ] Fixture has zero existing components, no Tailwind config, no tokens.
- [ ] Smoke transcript template lists the expected agent outputs at each step (starter banner, refusal to proceed, etc.).

**Verification steps:**
1. Run the documented sequence manually; confirm each expected output appears.

**Risks / unknowns:**
- Smoke tests are manual. Acceptable for v1; pilot phase (D) provides additional coverage.

---

#### Task 30: Mid-maturity smoke test fixture and script

**Phase:** C
**Spec sections:** Checkpoint C
**Behavior items covered:** (verification cross-cut)
**Depends on:** Task 28
**Size:** S

**Files touched (expected):**
- `tests/fixtures/mid-maturity-repo/` (shadcn components, tokens.ts)
- `tests/smoke/mid-maturity.md`

**Description:**
Create a sample repo with `components/ui/Button.tsx`, `components/ui/Stack.tsx`, `tokens.ts`, `tailwind.config.js`. Document the expected `/ui-learn` output and a no-network `/ui-refine` halt scenario.

**Acceptance criteria:**
- [ ] Fixture compiles (placeholder components OK).
- [ ] Smoke transcript covers `/ui-learn` and the `/ui-refine` MCP-unreachable halt.

**Verification steps:**
1. Run the sequence manually; confirm outputs.

**Risks / unknowns:**
- Mock MCP server is out of scope. The MCP-unreachable path is verified instead.

---

#### Task 31: README "Figma → React" section

**Phase:** D
**Spec sections:** §1.2, §9
**Behavior items covered:** 25 (split)
**Depends on:** Checkpoint C complete
**Size:** S

**Files touched (expected):**
- `README.md`

**Description:**
Add a top-level "Figma → React" section. Include the §1.2 prerequisites table verbatim, a one-paragraph lifecycle summary, the seven new commands in the existing slash-commands table, the new persona in the chat-mode-personas table.

**Acceptance criteria:**
- [ ] Table of contents updated.
- [ ] Prerequisites table identical to spec §1.2.
- [ ] Pointer to HOW_TO_USE for the full walkthrough.

**Verification steps:**
1. Render the README in VS Code preview; visually confirm table alignment and links.

**Risks / unknowns:**
- README length. Move long content to HOW_TO_USE; keep README scannable.

---

#### Task 32: Lifecycle diagram for UI workflow

**Phase:** D
**Spec sections:** §5.4
**Behavior items covered:** 25 (split)
**Depends on:** Task 31
**Size:** XS

**Files touched (expected):**
- `docs/ui-lifecycle.md` (or `README.md` inline)
- `docs/assets/ui-lifecycle.png` (optional)

**Description:**
Reproduce the §5.4 phase-transition diagram, plus an entry-arrow from the persona "Recommends" box. Use Mermaid for source-controllability; export PNG if needed for README rendering on GitHub.

**Acceptance criteria:**
- [ ] Diagram exists and renders on GitHub's markdown viewer.
- [ ] All seven commands appear at least once.

**Verification steps:**
1. Push to a branch; preview the README on GitHub; confirm rendering.

**Risks / unknowns:**
- Mermaid support on some viewers is inconsistent. Include a fallback PNG if needed.

---

#### Task 33: Examples gallery — greenfield walkthrough

**Phase:** D
**Spec sections:** §9
**Behavior items covered:** 25 (split)
**Depends on:** Task 29
**Size:** S

**Files touched (expected):**
- `docs/examples/greenfield.md`

**Description:**
Step-by-step worked example: empty repo → `/ui-learn` (accept defaults) → `/ui-refine <url>` → `/ui-spec` → `/ui-plan` → `/ui-build`. Include actual agent transcripts and the generated artifacts.

**Acceptance criteria:**
- [ ] Every command in the chain is exercised at least once.
- [ ] Includes the generated `repo-ui-guide.md` excerpt.

**Verification steps:**
1. Reproduce the example manually; commit the transcripts and a sample of generated files.

**Risks / unknowns:**
- Requires Dev Mode + a real Figma file. Document the sample Figma file URL or replace with a Framelink fallback path.

---

#### Task 34: Examples gallery — re-skin walkthrough

**Phase:** D
**Spec sections:** §9
**Behavior items covered:** 25 (split)
**Depends on:** Task 30
**Size:** S

**Files touched (expected):**
- `docs/examples/reskin.md`

**Description:**
Step-by-step worked example: existing page.tsx → `/ui-refine <url> --target=app/x/page.tsx` → `/ui-spec` (with self-check + approve) → `/ui-plan` → `/ui-build` (showing the contract gate enforcement).

**Acceptance criteria:**
- [ ] Includes the Preserve/Replace contract artifact.
- [ ] Shows the explicit `approve` step.
- [ ] Demonstrates the post-emit self-check passing.

**Verification steps:**
1. Reproduce manually; commit transcripts.

**Risks / unknowns:**
- Same as Task 33.

---

#### Task 35: Troubleshooting page for Figma MCP setup

**Phase:** D
**Spec sections:** §9
**Behavior items covered:** 25 (split)
**Depends on:** Task 22 (`/ui-mcp-status` output format must be stable)
**Size:** S

**Files touched (expected):**
- `docs/troubleshooting-figma-mcp.md`

**Description:**
Cover: enabling Dev Mode in Figma desktop, generating a PAT, PAT expired (401 error pattern), port 3845 in use (`lsof -i :3845`), Figma desktop signed out, `figma-developer-mcp` install failures (Node version, network proxy), how to interpret each line of `/ui-mcp-status`.

**Acceptance criteria:**
- [ ] Each failure mode has a symptom → diagnosis → fix triple.
- [ ] Cross-links to spec §3.8 and §4.9.

**Verification steps:**
1. Walk through the doc on a clean machine; verify each step is reproducible.

**Risks / unknowns:**
- Figma's UI for enabling Dev Mode may change. Pin a screenshot date.

---

#### Task 36: HOW_TO_USE.md additions

**Phase:** D
**Spec sections:** §9
**Behavior items covered:** 25 (split)
**Depends on:** Tasks 31, 32, 33, 34
**Size:** S

**Files touched (expected):**
- `HOW_TO_USE.md`

**Description:**
Add a new "Figma → React lifecycle" section after the existing Phase-0-through-Phase-8 walkthrough. Document the persona, the seven commands in workflow order, and link to the examples gallery and troubleshooting page.

**Acceptance criteria:**
- [ ] Section appears in the table of contents.
- [ ] Each command has a one-paragraph "use when" + a link to its spec section.

**Verification steps:**
1. Render preview; confirm anchor links resolve.

**Risks / unknowns:**
- None.

---

#### Task 37: Pilot — greenfield repo

**Phase:** D
**Spec sections:** §7 item 26
**Behavior items covered:** 26 (split)
**Depends on:** Checkpoint C complete
**Size:** S

**Files touched (expected):**
- `docs/pilots/greenfield-findings.md`

**Description:**
Run the full lifecycle on a chosen greenfield repo (suggestion: a fresh Next.js + Tailwind app). Record: time per phase, friction points, every halt/redirect encountered, every learning logged.

**Acceptance criteria:**
- [ ] Findings doc covers all 7 commands.
- [ ] Open Question status updates for §10 items observed during the pilot.

**Verification steps:**
1. The pilot is itself the verification.

**Risks / unknowns:**
- Pilot reveals spec gaps. Acceptable; record them as new Open Questions, not silent spec edits.

---

#### Task 38: Pilot — mid-maturity repo

**Phase:** D
**Spec sections:** §7 item 26
**Behavior items covered:** 26 (split)
**Depends on:** Checkpoint C complete
**Size:** S

**Files touched (expected):**
- `docs/pilots/mid-maturity-findings.md`

**Description:**
Pilot on a repo with shadcn/ui + tokens but no design-system rigor (suggestion: a 6-month-old SaaS frontend). Same recording format as Task 37.

**Acceptance criteria:**
- [ ] Findings doc covers the re-skin path with a real existing file.
- [ ] Records at least one PRESERVE-range violation attempt and its handling.

**Verification steps:**
1. The pilot is the verification.

**Risks / unknowns:**
- Re-skin in mid-maturity is the most failure-prone path. Pilot here is the deepest test.

---

#### Task 39: Pilot — mature design-system repo

**Phase:** D
**Spec sections:** §7 item 26
**Behavior items covered:** 26 (split)
**Depends on:** Checkpoint C complete
**Size:** S

**Files touched (expected):**
- `docs/pilots/mature-findings.md`

**Description:**
Pilot on a repo with a mature design system (suggestion: a repo with documented components, design tokens, and contribution guidelines). Focus on whether `/ui-flag` produces useful deviations and whether the Learnings appendix stays minimal (a sign the conventions are already captured elsewhere).

**Acceptance criteria:**
- [ ] Findings doc covers `/ui-flag` output quality.
- [ ] Records whether the Learnings appendix added zero, one, or many entries.

**Verification steps:**
1. The pilot is the verification.

**Risks / unknowns:**
- Mature repos may already encode conventions in places `/ui-learn` doesn't scan (Storybook, MDX docs). Record as an Open Question.

---

#### Task 40: Resolve or defer Open Questions; finalize spec § 10

**Phase:** D
**Spec sections:** §10
**Behavior items covered:** 26 (closeout)
**Depends on:** Tasks 37, 38, 39
**Size:** S

**Files touched (expected):**
- `docs/specs/figma-to-react-skill-spec.md`
- `docs/pilots/summary.md`

**Description:**
For each of the 5 Open Questions in spec §10: either resolve (record the resolution inline in §10 and update affected sections) or defer (record the deferral rationale and the planned trigger condition for revisiting). Write a pilot summary linking back to each finding.

**Acceptance criteria:**
- [ ] §10 has zero unresolved questions OR every question has an explicit deferral note.
- [ ] Pilot summary cites at least one finding per pilot repo.

**Verification steps:**
1. Diff §10 before/after; confirm each question has a "Resolved:" or "Deferred:" line.

**Risks / unknowns:**
- New questions surface during this task. Acceptable to add them — closeout is about the original five, not exhaustively eliminating uncertainty.

---

## 4. Cross-cutting concerns

### Idempotency tests
Tasks that mutate machine-global or user-global state must include a "run twice, second run is a no-op" assertion:
- **Task 2** — config migration.
- **Task 3** — `.cache/` rename.
- **Task 9** — committed config is already migrated.
- **Task 10** — `npm install` against an existing lockfile.
- **Task 12** — `mcp.json.bak.copilot-skills-pack` backup.
- **Task 13** — MCP entry registration (deep-equal skip).
- **Task 14** — PAT prompt skipped on re-run.
- **Task 16** — uninstall is safe to re-invoke.

### Secret hygiene
Tasks touching the PAT must:
- Never echo it to stdout (Task 14).
- Never log the value (length-only diagnostics OK).
- Never write it into `mcp.json` directly (use `${env:FIGMA_API_KEY}` reference, Task 13).
- Set file mode `0600` on the env file (Task 14).
- Default to keeping the env file on uninstall (Task 16).

### Backward compatibility
- **Task 5, 6:** must not regress the existing 20-skill install. Add a smoke test that captures the prompts-dir contents from the pre-change state and diffs after.
- **Task 9:** committed migrated config must produce identical install output to the pre-migration legacy config (modulo internal data shape).
- **Task 13:** `mcp.json` entries unrelated to the suite must survive every install/uninstall cycle.

---

## 5. Parallelization map

| Phase | Sequential chain | Parallelizable within phase |
|---|---|---|
| A | T1 → T2 → T3 → T4 → T5 → T6 → T9 | T7, T8 can run in parallel with T6 once it lands |
| B | T10 (independent) ; T11 → T12 → T13 → T14 → T16 → T17 | T15 can run in parallel with T14 once T13 lands; T10 fully independent of Phase-A tail |
| C | T18 → T19 → T20 → T21 → T22 → T23 → T24 → T25 → T26 ; T27 ; T28 → T29 / T30 | T19 and T20 parallel; T22 parallel with T21; T27 parallel with T23–T26; T29/T30 parallel after T28 |
| D | T31 → T36 ; T32 (after T31) ; T33/T34/T35 parallel after Checkpoint C ; T37/T38/T39 parallel ; T40 last | All three pilots run in parallel by separate operators |

The hard inter-phase sequencing: A before B (B uses installer plumbing); A before C (C registers via the new schema); C before D (docs reference shipped commands). B can start in parallel with the tail of A once T6 is merged.

---

## 6. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| PAT env-loading on editor-spawned processes (spec §10 Q#5) | High | Framelink unusable for users who launch the editor from Finder/Dock | Spike during T14: test `${env:FIGMA_API_KEY}` substitution in VS Code's MCP runtime; if it fails, fall back to a wrapper script that sources the env file before exec; document the chosen approach in the troubleshooting page (T35) |
| MCP tool-name drift between Dev Mode versions (Q#1) | Medium | Skill bodies break on Dev Mode upgrades | Discovery step at session start in every Figma-touching skill; `/ui-mcp-status` (T22) is the source of truth; pin Framelink version (T10) to bound the variability |
| Greenfield "use defaults" string match too fragile (Q#4) | Medium | First-run UX confusion | Document the exact phrase in the starter banner; add a `state.preferences.starterGuideAccepted` setter command in a follow-up if pilot reveals friction |
| Refactor in T5/T6 regresses existing 20 upstream skills | Medium | Existing users see broken installs | T5/T6 ACs include "all 20 skills still install"; capture the prompts-dir contents pre-change as a fixture and diff in CI |
| Cross-platform `mcp.json` paths (Cursor's path drift, Windows env-var differences) | Medium | Some users get a no-op install with no clear error | T11 resolver throws on unknown editor; T35 troubleshooting includes a "where is my mcp.json?" section |
| Self-check enumeration in `/ui-build` produces false-positive halts | Low | Builds halt incorrectly; dev frustration | The mitigation chain in spec §8.4 includes the contract-approval gate, explicit table, and always-on review; pilot (T38) is the deepest test |
| Marker convention mismatch: `mcp.json` is JSON, not markdown — markers behave differently | Low | Uninstall may miss managed entries | Use `_managedBy: "copilot-skills-pack"` sentinel field (T13); document in spec §3.8 |
| Pilot reveals that LLM-only contract enforcement (§8.4) is insufficient | Medium | Reskin path is unsafe in practice | Pilot T38 is the test; if it fails, file a follow-up to introduce a deterministic AST diff check as a separate v1.1 task |

---

## 7. Out of scope (mirrored from spec §1.1)

- Storybook / story file generation.
- Pixel-perfect screenshot-diff verification.
- Stacks other than React + TypeScript + Tailwind.
- Auto-wiring of data fetching, routing, state management, event handlers.
- Auto-execution of slash commands from within a persona.
- Refactoring or "improving" preserved code during re-skin.
- Animation, interaction states, responsive breakpoints beyond Figma auto-layout.
- Multi-repo / cross-repo Learnings sharing.
- Upstreaming the suite to `addyosmani/agent-skills` in v1.

Explicitly out of scope for **this plan** (above and beyond the spec):
- AST-based contract enforcement (deferred to a possible v1.1 if pilot demands).
- A `/ui-mcp-start` slash command (editor auto-spawns; not needed).
- Channel-ID handshake for bidirectional Figma editing (cursor-talk-to-figma-mcp); intentionally dropped in spec review.

---

## 8. Open questions surfaced during planning

These are net-new uncertainties discovered while planning that are not already in spec §10.

1. **`figma-developer-mcp` version pin choice.** Latest known-good at the time of T10 should be recorded in the commit message; a follow-up monitoring task may be needed to track upstream releases.
2. **Sentinel vs. marker for `mcp.json` entries.** The spec describes a markdown-style marker comment for `.md` files (§3.6); we propose `_managedBy: "copilot-skills-pack"` as the JSON analogue (T13). The spec does not formalize this — should §3.8 be amended to mention the sentinel explicitly? (Recommended: yes, but as a v1.1 spec amendment, not a blocker for this plan.)
3. **JSONC parsing strategy.** T12 proposes a tiny inline strip-comments routine to avoid a dependency. Alternative: add `jsonc-parser` (≈30KB). Decide during implementation; document the choice in code.
4. **CI for smoke tests.** Tasks 29 and 30 produce manual smoke procedures. There is no automated harness for chat-based testing. Adding one is out of scope for v1; record as a follow-up.
5. **Pilot repo selection.** Tasks 37–39 reference "suggestions" for pilot repos. The actual choice is up to the operator and may surface bias (e.g., choosing a repo that happens to map cleanly to the suite's assumptions). Document the pilot repo selection criteria before the pilot begins.

---

## 9. Summary

- **Total tasks:** 40
  - XS: 11 — T1, T7, T8, T9, T10, T11, T15, T17, T18, T28, T32
  - S: 21 — T2, T3, T4, T5, T12, T13, T14, T16, T19, T22, T25, T27, T29, T30, T31, T33, T34, T35, T36, T37, T38, T39, T40 *(actual S count: 23; see todo.md for the authoritative tally)*
  - M: 6 — T6, T20, T21, T23, T24, T26
- **Critical path (longest dependency chain):**
  T1 → T2 → T3 → T5 → T6 → T18 → T19 → T20 → T21 → T23 → T24 → T25 → T26 → T28 → T31 → T36 → T37 → T40 (18 tasks)
- **Three highest-risk items:**
  1. **T14 (PAT handling)** — secret hygiene is unforgiving; one mistake leaks the token. Mitigated by the explicit `--dry-run` audit (T17) and the "never log value" rule.
  2. **T13 (MCP entry registration)** — wrong `args` path or missing sentinel breaks Framelink for every user. Mitigated by deep-equal skip and unrelated-server preservation tests.
  3. **T20 (`frontend-craftsman` persona)** — wrong slash-recommendation table or missing mid-correction rule degrades the entire suite's UX. Mitigated by behavioral example coverage in §4.1 ACs.
- **Blocking open questions before Phase A starts:** None. Q#3 (JSONC parser choice) can be decided during T12 implementation.

Awaiting human review before any code lands.
