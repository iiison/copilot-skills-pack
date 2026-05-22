#!/usr/bin/env node
/**
 * copilot-skills-pack — cross-platform installer
 *
 * Installs addyosmani/agent-skills into your VS Code user prompts folder
 * as Copilot instructions / prompt files / chat modes.
 *
 * Usage:
 *   node setup.mjs                # interactive install
 *   node setup.mjs --yes          # non-interactive, accept defaults
 *   node setup.mjs --dry-run      # show what would happen, write nothing
 *   node setup.mjs --force        # overwrite existing files without asking
 *   node setup.mjs --target=cursor   # install into Cursor instead of VS Code
 *   node setup.mjs --target=insiders # install into VS Code Insiders
 *   node setup.mjs --uninstall    # remove all files this script installed
 *
 * Requirements: Node 18+, git on PATH.
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  resolveMcpConfigPath,
  readMcpJson,
  backupMcpJsonOnce,
  registerMcpServers,
  uninstallMcpServers,
  probeDevMode,
  patEnvFilePath,
  patResolutionState,
  writePatToEnvFile,
  deletePatFile,
} from "./lib/mcp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SOURCES_CACHE_BASE = path.join(ROOT, ".cache", "sources");
const LEGACY_CACHE_DIR = path.join(ROOT, ".cache", "agent-skills");
// Destination of the one-time legacy cache rename.
const CACHE_DIR = path.join(SOURCES_CACHE_BASE, "upstream");
const CONFIG_PATH = path.join(ROOT, "skills.config.json");
const MARKER = "<!-- managed-by: copilot-skills-pack -->";

const args = parseArgs(process.argv.slice(2));

// ─── Logging helpers ───────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m",
};
const isTTY = process.stdout.isTTY;
const paint = (color, s) => (isTTY ? color + s + c.reset : s);
const log = {
  info: (m) => console.log(paint(c.cyan, "ℹ"), m),
  ok: (m) => console.log(paint(c.green, "✓"), m),
  warn: (m) => console.log(paint(c.yellow, "⚠"), m),
  err: (m) => console.error(paint(c.red, "✗"), m),
  step: (m) => console.log("\n" + paint(c.bold + c.blue, "▶ " + m)),
  dim: (m) => console.log(paint(c.dim, "  " + m)),
};

// ─── Main ──────────────────────────────────────────────────────────────────
(async function main() {
  try {
    log.step("copilot-skills-pack installer");
    log.dim(`Platform: ${process.platform} | Node: ${process.version}`);

    if (args.uninstall) return uninstall();

    requireGit();
    const config = loadConfig();
    const choice = await resolveTargetDir();
    const targetDir = choice.promptsDir;
    log.info(`Target prompts dir: ${paint(c.bold, targetDir)}`);

    if (!args.yes && !args.dryRun) {
      const ok = await confirm(`Proceed with install into the folder above?`, true);
      if (!ok) return log.warn("Aborted.");
    }

    migrateCacheLayout();
    syncAllGitSources(config.sources);
    ensureDir(targetDir);

    const written = [];
    written.push(...installInstructions(config.alwaysOn, targetDir, config.sources));
    written.push(...installPrompts(config.onDemand, targetDir, config.sources));
    written.push(...installSlashCommands(config.slashCommands, targetDir, config.sources));
    written.push(...installPersonas(config.personas, targetDir, config.sources));

    enableChatPromptFiles(targetDir);

    if (!args.skipMcp) {
      if (choice.editor) await installMcp(choice.editor);
      else log.dim("MCP install skipped: --target-path override has no editor id");
    } else {
      log.dim("MCP install skipped: --skip-mcp");
    }

    log.step("Done");
    log.ok(`${written.length} files ${args.dryRun ? "would be" : ""} written into ${targetDir}`);
    if (args.dryRun) log.dim("(--dry-run: no files were actually written)");
    printNextSteps(config);
  } catch (err) {
    log.err(err.message);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
})();

// ─── Steps ─────────────────────────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) throw new Error(`Missing ${CONFIG_PATH}`);
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  return migrateConfigIfLegacy(raw);
}

/**
 * Migrate a legacy `skills.config.json` to the multi-source schema.
 *
 * Legacy shape:
 *   - top-level `source: { repo, ref }` (singular)
 *   - bare-string entries in onDemand / slashCommands / personas
 *   - alwaysOn entries without a `source` field
 *
 * New shape:
 *   - top-level `sources: [{ id, type, ... }]`
 *   - every entry is `{ name, source, ... }` (source defaults to "upstream")
 *
 * Idempotent: a fully migrated file is detected and returned unchanged.
 * Backups go to `<config>.bak.copilot-skills-pack` (created at most once).
 */
function migrateConfigIfLegacy(raw) {
  if (!detectLegacy(raw)) return raw;

  log.step("Migrating skills.config.json to multi-source schema");

  const migrated = {};
  if (raw.$schema) migrated.$schema = raw.$schema;

  if (Array.isArray(raw.sources)) {
    migrated.sources = raw.sources;
  } else if (raw.source && raw.source.repo && raw.source.ref) {
    migrated.sources = [
      { id: "upstream", type: "git", repo: raw.source.repo, ref: raw.source.ref },
    ];
  } else {
    throw new Error(
      "Cannot migrate skills.config.json: missing both `sources` and a usable `source` object."
    );
  }

  migrated.alwaysOn = (raw.alwaysOn || []).map((item) =>
    item.source ? item : { ...item, source: "upstream" }
  );

  for (const key of ["onDemand", "slashCommands", "personas"]) {
    migrated[key] = (raw[key] || []).map((item) => {
      if (typeof item === "string") return { name: item, source: "upstream" };
      return item.source ? item : { ...item, source: "upstream" };
    });
  }

  if (args.dryRun) {
    log.dim(`[dry-run] would back up ${path.basename(CONFIG_PATH)} and rewrite with multi-source schema`);
    return migrated;
  }

  backupOnce(CONFIG_PATH);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(migrated, null, 2) + "\n", "utf8");
  log.ok(`Migrated; backup at ${path.basename(CONFIG_PATH)}.bak.copilot-skills-pack`);
  return migrated;
}

function detectLegacy(raw) {
  if (raw.source && !raw.sources) return true;
  for (const key of ["onDemand", "slashCommands", "personas"]) {
    if (Array.isArray(raw[key]) && raw[key].some((it) => typeof it === "string")) return true;
  }
  if (Array.isArray(raw.alwaysOn) && raw.alwaysOn.some((it) => !it.source)) return true;
  return false;
}

/**
 * Resolve the on-disk root directory for a configured source.
 *   - type=git   → `<repo>/.cache/sources/<id>/`
 *   - type=local → `path.resolve(ROOT, src.path)`
 * Throws on an unknown source id or unsupported type.
 */
function resolveSourceDir(sources, sourceId) {
  const src = sources.find((s) => s.id === sourceId);
  if (!src) throw new Error(`Unknown source id: ${sourceId}`);
  if (src.type === "git") return path.join(SOURCES_CACHE_BASE, src.id);
  if (src.type === "local") return path.resolve(ROOT, src.path);
  throw new Error(`Unsupported source type for '${sourceId}': ${src.type}`);
}

/**
 * One-time rename of the pre-v2 cache directory.
 *   `.cache/agent-skills/`  →  `.cache/sources/upstream/`
 * Idempotent: returns silently if either the destination already exists or
 * the legacy path is absent.
 */
function migrateCacheLayout() {
  if (!fs.existsSync(LEGACY_CACHE_DIR)) return;
  if (fs.existsSync(CACHE_DIR)) return;
  log.info(`Renaming cache: ${path.relative(ROOT, LEGACY_CACHE_DIR)} → ${path.relative(ROOT, CACHE_DIR)}`);
  if (args.dryRun) {
    log.dim(`[dry-run] mv ${LEGACY_CACHE_DIR} ${CACHE_DIR}`);
    return;
  }
  ensureDir(path.dirname(CACHE_DIR));
  fs.renameSync(LEGACY_CACHE_DIR, CACHE_DIR);
}

function requireGit() {
  const r = spawnSync("git", ["--version"], { stdio: "ignore" });
  if (r.status !== 0) throw new Error("git is required but was not found on PATH.");
}

async function resolveTargetDir() {
  if (args.targetPath) {
    return { promptsDir: path.resolve(args.targetPath), editor: null };
  }

  const candidates = discoverEditors();
  if (candidates.length === 0) {
    throw new Error(
      "Could not find a VS Code / Insiders / Cursor user folder. " +
      "Pass --target-path=/absolute/path/to/User/prompts to override.",
    );
  }

  // --target=<name> filter
  let chosen = candidates;
  if (args.target) {
    chosen = candidates.filter((c) => c.id === args.target);
    if (!chosen.length) throw new Error(`No editor found matching --target=${args.target}. Found: ${candidates.map((c) => c.id).join(", ")}`);
  }

  if (chosen.length === 1 || args.yes) {
    return { promptsDir: path.join(chosen[0].userDir, "prompts"), editor: chosen[0] };
  }

  const idx = await pickFromList(
    "Multiple editors detected. Which one to install into?",
    chosen.map((c) => `${c.label}  ${paint(c.dim, "(" + c.userDir + ")")}`),
  );
  return { promptsDir: path.join(chosen[idx].userDir, "prompts"), editor: chosen[idx] };
}

function discoverEditors() {
  const home = os.homedir();
  const editors = [];
  const candidates = [
    { id: "vscode", label: "VS Code", paths: vsUserDirs(home, "Code") },
    { id: "insiders", label: "VS Code Insiders", paths: vsUserDirs(home, "Code - Insiders") },
    { id: "cursor", label: "Cursor", paths: vsUserDirs(home, "Cursor") },
    { id: "vscodium", label: "VSCodium", paths: vsUserDirs(home, "VSCodium") },
  ];
  for (const cand of candidates) {
    for (const p of cand.paths) {
      if (fs.existsSync(p)) {
        editors.push({ id: cand.id, label: cand.label, userDir: p });
        break;
      }
    }
  }
  return editors;
}

function vsUserDirs(home, productName) {
  if (process.platform === "darwin") {
    return [path.join(home, "Library", "Application Support", productName, "User")];
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [path.join(appData, productName, "User")];
  }
  // linux + others
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return [path.join(xdg, productName, "User")];
}

function syncAllGitSources(sources) {
  log.step("Sync skills sources");
  const gitSources = sources.filter((s) => s.type === "git");
  if (gitSources.length === 0) {
    log.dim("no git sources configured");
    return;
  }
  ensureDir(SOURCES_CACHE_BASE);
  for (const src of gitSources) {
    syncOneGitSource(src);
  }
}

function syncOneGitSource(src) {
  const dir = path.join(SOURCES_CACHE_BASE, src.id);
  if (fs.existsSync(path.join(dir, ".git"))) {
    log.info(`Updating cached '${src.id}' (${src.repo} @ ${src.ref})…`);
    runGit(["-C", dir, "fetch", "--depth=1", "origin", src.ref]);
    runGit(["-C", dir, "checkout", src.ref]);
    runGit(["-C", dir, "reset", "--hard", `origin/${src.ref}`]);
  } else {
    log.info(`Cloning '${src.id}': ${src.repo} (ref: ${src.ref})…`);
    runGit(["clone", "--depth=1", "--branch", src.ref, src.repo, dir]);
  }
  log.ok(`Source '${src.id}' ready at ${dir}`);
}

function runGit(argv) {
  if (args.dryRun) return log.dim(`[dry-run] git ${argv.join(" ")}`);
  const r = spawnSync("git", argv, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`git ${argv.join(" ")} failed`);
}

function installInstructions(items, targetDir, sources) {
  log.step(`Always-on instructions (${items.length})`);
  warnOnCollisions(items, "always-on instruction");
  const written = [];
  for (const item of items) {
    const sourceDir = safeResolveSource(sources, item.source, `always-on '${item.name}'`);
    if (!sourceDir) continue;
    const src = path.join(sourceDir, "skills", item.name, "SKILL.md");
    if (!fs.existsSync(src)) {
      log.warn(`skip ${item.name}: ${path.relative(ROOT, src)} not found`);
      continue;
    }
    const body = fs.readFileSync(src, "utf8");
    const stripped = stripFrontmatter(body);
    const out = path.join(targetDir, `${item.name}.instructions.md`);
    const content =
      `---\n` +
      `applyTo: ${JSON.stringify(item.applyTo)}\n` +
      `description: ${JSON.stringify(item.note || `Always-on skill: ${item.name}`)}\n` +
      `---\n${MARKER}\n\n${stripped.trim()}\n`;
    if (writeManaged(out, content)) written.push(out);
  }
  return written;
}

function installPrompts(items, targetDir, sources) {
  log.step(`On-demand prompts (${items.length})`);
  warnOnCollisions(items, "on-demand prompt");
  const written = [];
  for (const item of items) {
    const sourceDir = safeResolveSource(sources, item.source, `on-demand '${item.name}'`);
    if (!sourceDir) continue;
    const src = path.join(sourceDir, "skills", item.name, "SKILL.md");
    if (!fs.existsSync(src)) {
      log.warn(`skip ${item.name}: ${path.relative(ROOT, src)} not found`);
      continue;
    }
    const body = stripFrontmatter(fs.readFileSync(src, "utf8"));
    const out = path.join(targetDir, `${item.name}.prompt.md`);
    const content =
      `---\n` +
      `mode: ask\n` +
      `description: ${JSON.stringify(`On-demand skill: ${item.name}`)}\n` +
      `---\n${MARKER}\n\n${body.trim()}\n`;
    if (writeManaged(out, content)) written.push(out);
  }
  return written;
}

function installSlashCommands(items, targetDir, sources) {
  warnOnCollisions(items, "slash command");
  log.step(`Slash commands (${items.length})`);
  const written = [];
  for (const item of items) {
    const src = resolveSlashCommandFile(sources, item);
    if (!src) {
      log.warn(`skip /${item.name}: command file not found`);
      continue;
    }
    const body = stripFrontmatter(fs.readFileSync(src, "utf8"));
    const out = path.join(targetDir, `${item.name}.prompt.md`);
    const content =
      `---\n` +
      `mode: agent\n` +
      `description: ${JSON.stringify(`Lifecycle command: /${item.name}`)}\n` +
      `---\n${MARKER}\n\n${body.trim()}\n`;
    if (writeManaged(out, content)) written.push(out);
  }
  return written;
}

function installPersonas(items, targetDir, sources) {
  warnOnCollisions(items, "persona");
  log.step(`Agent personas / chat modes (${items.length})`);
  const written = [];
  for (const item of items) {
    const sourceDir = safeResolveSource(sources, item.source, `persona '${item.name}'`);
    if (!sourceDir) continue;
    const src = path.join(sourceDir, "agents", `${item.name}.md`);
    if (!fs.existsSync(src)) {
      log.warn(`skip persona ${item.name}: ${path.relative(ROOT, src)} not found`);
      continue;
    }
    const body = stripFrontmatter(fs.readFileSync(src, "utf8"));
    const out = path.join(targetDir, `${item.name}.chatmode.md`);
    const toolsLine = Array.isArray(item.tools)
      ? `tools: [${item.tools.map((t) => JSON.stringify(t)).join(", ")}]\n`
      : "";
    const content =
      `---\n` +
      `description: ${JSON.stringify(`Persona: ${item.name}`)}\n` +
      toolsLine +
      `---\n${MARKER}\n\n${body.trim()}\n`;
    if (writeManaged(out, content)) written.push(out);
  }
  return written;
}

/**
 * Slash-command file resolution diverges by source type:
 *   - git   → `<sourceDir>/.claude/commands/<name>.md` then `.gemini/commands/<name>.md`
 *   - local → `<sourceDir>/skills/<name>/SKILL.md`
 */
function resolveSlashCommandFile(sources, item) {
  const sourceDir = safeResolveSource(sources, item.source, `/${item.name}`);
  if (!sourceDir) return null;
  const src = sources.find((s) => s.id === item.source);
  if (src && src.type === "local") {
    const p = path.join(sourceDir, "skills", item.name, "SKILL.md");
    return fs.existsSync(p) ? p : null;
  }
  // git (and any future remote type): preserve the upstream fallback chain
  const candidates = [
    path.join(sourceDir, ".claude", "commands", `${item.name}.md`),
    path.join(sourceDir, ".gemini", "commands", `${item.name}.md`),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**Warn when the same name appears in multiple entries of the same array.
 * Later entries win (the install loop overwrites in order). No-op if the
 * array has zero duplicates.
 */
function warnOnCollisions(items, kind) {
  const seen = new Map();
  for (const item of items) {
    const prev = seen.get(item.name);
    if (prev) {
      log.warn(
        `${kind} '${item.name}' defined by both '${prev}' and '${item.source}'; ` +
        `using '${item.source}' (later entry wins)`
      );
    }
    seen.set(item.name, item.source);
  }
}

/**
 * 
 * Resolve a source dir, logging a warning instead of throwing when the source
 * id is unknown. Returns `null` if the lookup failed (callers should skip
 * the entry rather than abort the whole install).
 */
function safeResolveSource(sources, sourceId, label) {
  if (!sourceId) {
    log.warn(`skip ${label}: missing 'source' field`);
    return null;
  }
  try {
    const dir = resolveSourceDir(sources, sourceId);
    // For local sources, warn (but allow) when the path does not exist yet.
    const src = sources.find((s) => s.id === sourceId);
    if (src && src.type === "local" && !fs.existsSync(dir)) {
      log.warn(`source '${sourceId}' path does not exist: ${path.relative(ROOT, dir)}`);
      return null;
    }
    return dir;
  } catch (e) {
    log.warn(`skip ${label}: ${e.message}`);
    return null;
  }
}

function enableChatPromptFiles(promptsDir) {
  log.step("Ensure chat.promptFiles is enabled");
  const settingsPath = path.join(path.dirname(promptsDir), "settings.json");
  if (!fs.existsSync(settingsPath)) {
    log.warn(`settings.json not found at ${settingsPath} — skipping. Enable "chat.promptFiles": true manually if needed.`);
    return;
  }
  const raw = fs.readFileSync(settingsPath, "utf8");
  if (/"chat\.promptFiles"\s*:\s*true/.test(raw)) {
    log.ok('"chat.promptFiles": true already set');
    return;
  }
  if (args.dryRun) return log.dim(`[dry-run] would patch ${settingsPath}`);

  // Conservative JSONC-safe patch: insert before the last closing brace.
  // We avoid full JSONC parsing; if the patch can't be applied cleanly we just warn.
  const patched = patchSettingsJson(raw);
  if (patched === raw) {
    log.warn("Could not auto-patch settings.json. Add this manually:");
    log.dim('  "chat.promptFiles": true');
    return;
  }
  backupOnce(settingsPath);
  fs.writeFileSync(settingsPath, patched, "utf8");
  log.ok("Patched settings.json");
}

function patchSettingsJson(raw) {
  // find last `}`
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace < 0) return raw;
  const before = raw.slice(0, lastBrace);
  const after = raw.slice(lastBrace);
  const trimmed = before.replace(/\s+$/, "");
  const needsComma = !/[{,]\s*$/.test(trimmed);
  const insertion = `${needsComma ? "," : ""}\n  "chat.promptFiles": true\n`;
  return trimmed + insertion + after;
}

// ─── Uninstall ─────────────────────────────────────────────────────────────
async function uninstall() {
  log.step("Uninstall — removing managed files");
  const candidates = discoverEditors();
  let total = 0;
  for (const ed of candidates) {
    const dir = path.join(ed.userDir, "prompts");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        const body = fs.readFileSync(p, "utf8");
        if (body.includes(MARKER)) {
          if (args.dryRun) log.dim(`[dry-run] rm ${p}`);
          else fs.unlinkSync(p);
          total++;
        }
      } catch { /* ignore */ }
    }
  }
  log.ok(`${total} managed files ${args.dryRun ? "would be" : ""} removed`);
  await uninstallMcpAll(candidates);
}

// ─── MCP installation (T11–T17) ────────────────────────────────────────────

/**
 * Resolve the absolute path to the Framelink CLI shipped with the pinned
 * `figma-developer-mcp` dependency. Uses the package's `bin` map so we
 * track upstream renames without hard-coding `dist/cli.js` vs `dist/bin.js`.
 */
function resolveFramelinkCli() {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("figma-developer-mcp/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const bin = typeof pkg.bin === "string"
    ? pkg.bin
    : pkg.bin && pkg.bin["figma-developer-mcp"];
  if (!bin) throw new Error("figma-developer-mcp package.json has no usable `bin` field");
  return path.resolve(path.dirname(pkgPath), bin);
}

/**
 * Full MCP install for one editor: backup mcp.json → register servers →
 * resolve PAT (env or file or prompt) → reachability probe. Non-fatal:
 * any single step failing logs a warning and the install continues.
 */
async function installMcp(editor) {
  log.step(`Figma MCP servers (${editor.label})`);

  // 1. Ensure the pinned package is installed.
  const nodeModulesPkg = path.join(ROOT, "node_modules", "figma-developer-mcp", "package.json");
  if (!fs.existsSync(nodeModulesPkg)) {
    if (args.dryRun) {
      log.dim(`[dry-run] would run: npm install (figma-developer-mcp missing)`);
    } else {
      log.info("Installing figma-developer-mcp (one-time)…");
      const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit" });
      if (r.status !== 0) {
        log.warn("npm install failed; MCP step skipped. Run `npm install` manually and re-run.");
        return;
      }
    }
  }

  let framelinkCli;
  try { framelinkCli = resolveFramelinkCli(); }
  catch (e) {
    log.warn(`MCP step skipped: ${e.message}`);
    return;
  }

  // 2. Locate, back up, and parse mcp.json.
  const mcpPath = resolveMcpConfigPath(editor.id, editor.userDir);
  let mcp;
  try { mcp = readMcpJson(mcpPath); }
  catch (e) {
    log.warn(e.message);
    return;
  }
  backupMcpJsonOnce(mcpPath, { dryRun: args.dryRun });

  // 3. Register entries (conservative: skip on drift unless --force).
  const result = registerMcpServers(mcp, framelinkCli, { force: args.force });
  for (const name of result.conflicts) {
    log.warn(`'${name}' already exists in mcp.json with a different shape; not overwriting (re-run with --force to update)`);
  }
  if (result.changed) {
    if (args.dryRun) {
      log.dim(`[dry-run] would write ${mcpPath}`);
    } else {
      ensureDir(path.dirname(mcpPath));
      fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n", "utf8");
      log.ok(`updated ${path.relative(os.homedir(), mcpPath)}`);
    }
  } else {
    log.dim("mcp.json unchanged");
  }

  // 4. Resolve PAT.
  await ensurePatConfigured();

  // 5. Probe Dev Mode (non-fatal).
  const probe = await probeDevMode("http://127.0.0.1:3845/sse", { timeoutMs: 3000 });
  if (probe.reachable) {
    log.ok("Figma Dev Mode MCP reachable");
  } else {
    log.warn(`Figma Dev Mode MCP not reachable (${probe.reason || "unknown"})`);
    log.dim("  Enable it in Figma desktop: Preferences → Enable local MCP server");
    log.dim("  Then open a frame and use Dev Mode in the side panel.");
  }
}

/**
 * Resolve the PAT for the current user. Order: env var > stored file > prompt.
 * On `--dry-run`, prints intent without prompting or writing.
 * On `--yes`, skips the prompt and continues without a stored token (env
 * substitution at runtime may still work).
 */
async function ensurePatConfigured() {
  const home = os.homedir();
  const state = patResolutionState({ home, envValue: process.env.FIGMA_API_KEY });
  if (state.source === "env") {
    log.dim("PAT: using FIGMA_API_KEY from environment");
    return;
  }
  if (state.source === "file") {
    log.dim(`PAT: using stored token (length: ${state.value.length})`);
    return;
  }
  // none — needs prompt
  if (args.dryRun) {
    log.dim(`[dry-run] would prompt for FIGMA_API_KEY and write ${patEnvFilePath(home)} (mode 0600)`);
    return;
  }
  if (args.yes) {
    log.warn("No FIGMA_API_KEY found. Skipping prompt (--yes). Framelink will not work until you set it.");
    log.dim(`  Either: export FIGMA_API_KEY=… in your shell, or write the token to ${patEnvFilePath(home)}`);
    return;
  }
  const token = await promptHidden("Enter Figma Personal Access Token (input hidden; Enter to skip): ");
  if (!token) {
    log.warn("Skipped. Framelink will not work until FIGMA_API_KEY is set.");
    return;
  }
  writePatToEnvFile(home, token);
  log.ok(`PAT stored (length: ${token.length}) at ${path.relative(home, patEnvFilePath(home))}`);
}

/**
 * Read a line of input from stdin without echoing it to the terminal.
 * Uses readline's `_writeToOutput` override to swallow the typed bytes.
 *
 * @param {string} q
 * @returns {Promise<string>}  the entered token, trimmed, or '' on skip
 */
function promptHidden(q) {
  return new Promise((resolve) => {
    const r = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // mute echo: swallow every character readline would emit
    r._writeToOutput = function (s) {
      if (s === q || s === "\r\n" || s === "\n") {
        process.stdout.write(s);
      }
      // otherwise, swallow typed characters (no asterisks — avoids leaking length)
    };
    r.question(q, (ans) => {
      r.close();
      resolve((ans || "").trim());
    });
  });
}

/**
 * Uninstall MCP entries from every editor's mcp.json. Optionally remove
 * the PAT file (default: keep — explicit `y` required even in --yes mode).
 */
async function uninstallMcpAll(editors) {
  log.step("Uninstall — Figma MCP entries");
  let totalRemoved = 0;
  for (const ed of editors) {
    const mcpPath = resolveMcpConfigPath(ed.id, ed.userDir);
    if (!fs.existsSync(mcpPath)) continue;
    let mcp;
    try { mcp = readMcpJson(mcpPath); }
    catch (e) { log.warn(e.message); continue; }
    const { removed } = uninstallMcpServers(mcp);
    if (removed.length === 0) continue;
    if (args.dryRun) {
      log.dim(`[dry-run] would remove ${removed.join(", ")} from ${mcpPath}`);
    } else {
      fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n", "utf8");
      log.ok(`removed ${removed.join(", ")} from ${path.basename(mcpPath)} (${ed.label})`);
    }
    totalRemoved += removed.length;
  }
  if (totalRemoved === 0) log.dim("no managed MCP entries found");

  // PAT file: kept by default. Prompt once; --yes is a soft "no".
  const home = os.homedir();
  const patPath = patEnvFilePath(home);
  if (!fs.existsSync(patPath)) return;
  if (args.yes || args.dryRun) {
    if (args.force && !args.dryRun) {
      deletePatFile(home);
      log.ok(`removed ${patPath}`);
    } else if (args.force && args.dryRun) {
      log.dim(`[dry-run] would rm ${patPath}`);
    } else {
      log.dim(`PAT file preserved at ${patPath} (re-run with --force to delete)`);
    }
    return;
  }
  // interactive
  const yes = await confirm(`Also delete the PAT at ${patPath}?`, false);
  if (yes) {
    deletePatFile(home);
    log.ok(`removed ${patPath}`);
  } else {
    log.dim(`kept ${patPath}`);
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────
function stripFrontmatter(s) {
  if (!s.startsWith("---")) return s;
  const end = s.indexOf("\n---", 3);
  if (end === -1) return s;
  return s.slice(end + 4).replace(/^\r?\n/, "");
}

function writeManaged(filePath, content) {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8");
    if (!existing.includes(MARKER) && !args.force) {
      log.warn(`skip (not managed): ${path.basename(filePath)} — pass --force to overwrite`);
      return false;
    }
    if (existing === content) {
      log.dim(`unchanged: ${path.basename(filePath)}`);
      return true;
    }
  }
  if (args.dryRun) {
    log.dim(`[dry-run] write ${filePath}`);
    return true;
  }
  fs.writeFileSync(filePath, content, "utf8");
  log.ok(`wrote ${path.basename(filePath)}`);
  return true;
}

function ensureDir(d) {
  if (!fs.existsSync(d)) {
    if (args.dryRun) return log.dim(`[dry-run] mkdir -p ${d}`);
    fs.mkdirSync(d, { recursive: true });
  }
}

function backupOnce(p) {
  const bak = p + ".bak.copilot-skills-pack";
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
}

function parseArgs(argv) {
  const o = { yes: false, dryRun: false, force: false, uninstall: false, target: null, targetPath: null, skipMcp: false };
  for (const a of argv) {
    if (a === "--yes" || a === "-y") o.yes = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force") o.force = true;
    else if (a === "--uninstall") o.uninstall = true;
    else if (a === "--skip-mcp") o.skipMcp = true;
    else if (a.startsWith("--target=")) o.target = a.slice("--target=".length);
    else if (a.startsWith("--target-path=")) o.targetPath = a.slice("--target-path=".length);
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return o;
}

function printHelp() {
  console.log(`copilot-skills-pack setup

Usage: node setup.mjs [options]

Options:
  -y, --yes              Non-interactive; accept defaults
      --dry-run          Show what would happen; write nothing
      --force            Overwrite existing files even if not managed
      --target=<id>      Editor: vscode | insiders | cursor | vscodium
      --target-path=<p>  Absolute path to a User/prompts dir (overrides detection)
      --skip-mcp         Skip the Figma MCP server registration step
      --uninstall        Remove all files written by this installer
                         (includes managed mcp.json entries; PAT file kept by default)
  -h, --help             Show this message

The install runs two stages:
  1. Copy skills (instructions, prompts, slash commands, personas) into
     your editor's prompts/ directory.
  2. Register Figma MCP servers (figma-dev-mode + figma-framelink) into
     your editor's mcp.json. The Framelink server reads FIGMA_API_KEY
     from \`~/.copilot-skills-pack/.env\` (mode 0600) or the shell env.
`);
}

function printNextSteps(config) {
  const slashList = config.slashCommands.map((s) => `/${s.name}`).join("  ");
  const personaList = config.personas.map((s) => s.name).join(" · ");
  const onDemandSample = config.onDemand.slice(0, 3).map((s) => s.name).join(", ");

  console.log(`
${paint(c.bold, "Next steps:")}
  1. Reload your editor window (Cmd/Ctrl+Shift+P → "Developer: Reload Window").
  2. Open Copilot Chat. Type "/" to see lifecycle commands:
       ${slashList}
  3. Pick a chat mode from the mode dropdown:
       ${personaList}
  4. Always-on skills auto-apply to matching files based on \`applyTo\` globs.
  5. To invoke an on-demand skill, attach it: type "#" in chat and pick e.g.
       ${onDemandSample} …

${paint(c.dim, "Update later: git pull && node setup.mjs --yes")}
${paint(c.dim, "Uninstall:    node setup.mjs --uninstall")}
`);
}

function rl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function confirm(q, def = true) {
  if (args.yes) return Promise.resolve(true);
  return new Promise((res) => {
    const r = rl();
    r.question(`${q} ${def ? "[Y/n]" : "[y/N]"} `, (ans) => {
      r.close();
      const a = ans.trim().toLowerCase();
      if (!a) return res(def);
      res(a === "y" || a === "yes");
    });
  });
}

function pickFromList(prompt, items) {
  console.log(prompt);
  items.forEach((label, i) => console.log(`  ${i + 1}) ${label}`));
  return new Promise((res) => {
    const r = rl();
    r.question("Choose [1]: ", (ans) => {
      r.close();
      const n = parseInt(ans.trim() || "1", 10);
      if (Number.isNaN(n) || n < 1 || n > items.length) return res(0);
      res(n - 1);
    });
  });
}
