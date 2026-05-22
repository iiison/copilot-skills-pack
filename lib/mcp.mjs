/**
 * MCP installation helpers for copilot-skills-pack.
 *
 * Pure, side-effect-aware functions consumed by setup.mjs. All file I/O
 * is gated by an explicit `dryRun` flag passed by the caller, so tests
 * can exercise the logic without touching disk.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

/**
 * Resolve the absolute path to the editor's `mcp.json`.
 *
 * Editor conventions (spec §3.8.1 step 1):
 *   - vscode / insiders / vscodium → `<userDir>/mcp.json`
 *   - cursor                       → `~/.cursor/mcp.json`
 *
 * Cursor stores MCP config at a fixed location regardless of which
 * `User` folder it uses; the `userDir` argument is ignored for it.
 *
 * @param {string} editorId  one of: vscode | insiders | vscodium | cursor
 * @param {string} userDir   absolute path to the editor's User directory
 * @returns {string} absolute path to mcp.json
 */
export function resolveMcpConfigPath(editorId, userDir) {
  switch (editorId) {
    case "vscode":
    case "insiders":
    case "vscodium":
      return path.join(userDir, "mcp.json");
    case "cursor":
      return path.join(os.homedir(), ".cursor", "mcp.json");
    default:
      throw new Error(
        `unknown editor id: ${editorId} (expected: vscode | insiders | vscodium | cursor)`,
      );
  }
}

const MCP_BACKUP_SUFFIX = ".bak.copilot-skills-pack";

/**
 * Sentinel field added to every server entry this installer owns. Used by
 * `--uninstall` (T16) to identify managed entries without ambiguity and by
 * `registerMcpServers` (T13) to detect user-modified entries that we must
 * not overwrite.
 *
 * Note: this is a convention, not a contract. A user who copies the
 * sentinel into a hand-written entry will see that entry removed on
 * uninstall — documented limitation.
 */
export const MANAGED_SENTINEL = "copilot-skills-pack";

/** Names of the MCP servers this installer manages. */
export const MANAGED_SERVERS = ["figma-dev-mode", "figma-framelink"];

/**
 * Parse JSONC (JSON with line/block comments and trailing commas).
 *
 * Strategy: stream-tokenize once, copying characters into an output buffer
 * while tracking whether we are inside a string. Strings are copied
 * verbatim (escapes included); comments outside strings are dropped;
 * `,` followed by optional whitespace and a `}` or `]` is dropped.
 *
 * Why not a dependency: the installer is zero-deps by design; this routine
 * is ~30 lines and covers the cases editors emit (// and /* *​/, trailing
 * commas). For truly hostile input we fall back to `JSON.parse`'s error.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonc(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    // string literal — copy verbatim including escapes
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === '"') { j++; break; }
        j++;
      }
      out += text.slice(i, j);
      i = j;
      continue;
    }
    // line comment
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i + 2);
      i = nl === -1 ? n : nl;
      continue;
    }
    // block comment
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    // trailing comma: emit unless next non-whitespace is } or ]
    if (ch === ",") {
      let k = i + 1;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === "}" || text[k] === "]") {
        i++; // drop the comma
        continue;
      }
    }
    out += ch;
    i++;
  }
  try {
    return JSON.parse(out);
  } catch (err) {
    const e = new Error(`JSONC parse error: ${err.message}`);
    e.cause = err;
    throw e;
  }
}

/**
 * Read and parse an editor `mcp.json`.
 *
 * @param {string} mcpPath  absolute path to mcp.json
 * @returns {{ servers: Record<string, any>, [k: string]: any }}
 *   Always returns an object whose `servers` field is at least `{}`.
 *
 * @throws if the file exists but cannot be parsed even as JSONC. The error
 *   message includes the file path so the user can locate it; the file
 *   itself is never modified by this function.
 */
export function readMcpJson(mcpPath) {
  if (!fs.existsSync(mcpPath)) return { servers: {} };
  const raw = fs.readFileSync(mcpPath, "utf8");
  let parsed;
  try {
    parsed = parseJsonc(raw);
  } catch (err) {
    throw new Error(
      `Could not parse ${mcpPath}: ${err.message}\n` +
      `  Fix the file by hand and re-run; the installer will not modify a broken mcp.json.`,
    );
  }
  if (!parsed || typeof parsed !== "object") return { servers: {} };
  if (!parsed.servers || typeof parsed.servers !== "object") parsed.servers = {};
  return parsed;
}

/**
 * Copy `mcp.json` to `mcp.json.bak.copilot-skills-pack` exactly once.
 * Subsequent calls are a no-op (the .bak is never overwritten). Missing
 * source files are silently skipped.
 *
 * @param {string} mcpPath
 * @param {{ dryRun?: boolean }} [opts]
 */
export function backupMcpJsonOnce(mcpPath, opts = {}) {
  if (!fs.existsSync(mcpPath)) return;
  const bak = mcpPath + MCP_BACKUP_SUFFIX;
  if (fs.existsSync(bak)) return;
  if (opts.dryRun) return;
  fs.copyFileSync(mcpPath, bak);
}

/**
 * Build the canonical shape of the two MCP server entries we manage.
 *
 * The shape of `figma-framelink` reflects the Framelink upstream contract:
 *   - `type: "stdio"` + `command: "node"` + the absolute path to the CLI
 *     binary in `args[0]` (resolved by the caller via `require.resolve`).
 *   - `env.FIGMA_API_KEY` uses the `${env:FIGMA_API_KEY}` substitution
 *     pattern supported by VS Code's MCP runtime. T14 stores the token
 *     to disk; the editor is responsible for injecting it.
 *
 * @param {string} framelinkCliPath  absolute path to `figma-developer-mcp/dist/bin.js`
 * @returns {Record<string, object>}
 */
export function buildMcpEntries(framelinkCliPath) {
  return {
    "figma-dev-mode": {
      type: "sse",
      url: "http://127.0.0.1:3845/sse",
      _managedBy: MANAGED_SENTINEL,
    },
    "figma-framelink": {
      type: "stdio",
      command: "node",
      args: [framelinkCliPath],
      env: { FIGMA_API_KEY: "${env:FIGMA_API_KEY}" },
      _managedBy: MANAGED_SENTINEL,
    },
  };
}

/**
 * Insert / refresh the two managed MCP server entries into `mcp.servers`.
 *
 * Behavior:
 *   - Slot is empty           → write the canonical entry.
 *   - Slot deep-equals target → no change (idempotent).
 *   - Slot exists, content drifted → conflict. Do not overwrite unless
 *     the caller passes `{ force: true }`. This is conservative: we cannot
 *     tell whether the drift is a user edit or an upstream-shape change,
 *     so we ask the caller to decide. `--yes` mode never forces.
 *
 * Mutates `mcp` in place. Returns `{ changed, conflicts, managed }`.
 *
 * @param {{ servers: Record<string, any> }} mcp
 * @param {string} framelinkCliPath
 * @param {{ force?: boolean }} [opts]
 * @returns {{ changed: boolean, conflicts: string[], managed: string[] }}
 */
export function registerMcpServers(mcp, framelinkCliPath, opts = {}) {
  const target = buildMcpEntries(framelinkCliPath);
  const conflicts = [];
  let changed = false;

  for (const name of MANAGED_SERVERS) {
    const want = target[name];
    const have = mcp.servers[name];

    if (!have) {
      mcp.servers[name] = want;
      changed = true;
      continue;
    }
    if (deepEqual(have, want)) continue;

    if (opts.force) {
      mcp.servers[name] = want;
      changed = true;
    } else {
      conflicts.push(name);
    }
  }

  return { changed, conflicts, managed: MANAGED_SERVERS.slice() };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

// ─── PAT storage (T14) ─────────────────────────────────────────────────────
//
// Security contract:
//   - The token is never logged. The only diagnostic we emit is its length.
//   - File mode is 0600, parent directory is 0700 (POSIX).
//   - Writes are skipped on dry-run.
//   - The token in `process.env.FIGMA_API_KEY` takes precedence over the
//     file, so CI and users with shell-managed secrets bypass the on-disk
//     store entirely.

const PAT_DIR_NAME = ".copilot-skills-pack";
const PAT_FILE_NAME = ".env";
const PAT_VAR = "FIGMA_API_KEY";

/** Absolute path to the PAT env file under the given HOME. */
export function patEnvFilePath(home) {
  return path.join(home, PAT_DIR_NAME, PAT_FILE_NAME);
}

/**
 * Read the FIGMA_API_KEY value out of `<home>/.copilot-skills-pack/.env`.
 * Returns `null` if the file is missing or the value is empty.
 *
 * Format: tolerant of comments (`#`) and unrelated `KEY=VALUE` lines.
 * Strips a single set of surrounding quotes if present.
 */
export function readPatFromEnvFile(home) {
  const p = patEnvFilePath(home);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== PAT_VAR) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    return val || null;
  }
  return null;
}

/**
 * Write the token to `<home>/.copilot-skills-pack/.env` at mode 0600.
 *
 * @param {string} home
 * @param {string} token  trimmed PAT
 * @param {{ dryRun?: boolean }} [opts]
 */
export function writePatToEnvFile(home, token, opts = {}) {
  if (opts.dryRun) return;
  const dir = path.join(home, PAT_DIR_NAME);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // mkdir with mode may be honored on some platforms only at creation; force.
  if (process.platform !== "win32") {
    try { fs.chmodSync(dir, 0o700); } catch { /* best-effort on Windows-like FS */ }
  }
  const file = patEnvFilePath(home);
  fs.writeFileSync(file, `${PAT_VAR}=${token}\n`, "utf8");
  if (process.platform !== "win32") {
    try { fs.chmodSync(file, 0o600); } catch { /* same */ }
  }
}

/**
 * Decide where the PAT comes from. Pure: only file-system reads and the
 * supplied `envValue`. Does not prompt; the prompt is in setup.mjs.
 *
 * Resolution order (spec §3.8.1 step 6):
 *   1. `process.env.FIGMA_API_KEY` set & non-empty → use it.
 *   2. `<home>/.copilot-skills-pack/.env` present with non-empty value → use it.
 *   3. otherwise → prompt the user.
 *
 * @param {{ home: string, envValue: string | undefined }} ctx
 * @returns {{ source: "env"|"file"|"none", needsPrompt: boolean, value: string|null }}
 */
export function patResolutionState({ home, envValue }) {
  if (envValue && envValue.trim().length > 0) {
    return { source: "env", needsPrompt: false, value: envValue.trim() };
  }
  const fromFile = readPatFromEnvFile(home);
  if (fromFile) return { source: "file", needsPrompt: false, value: fromFile };
  return { source: "none", needsPrompt: true, value: null };
}

// ─── Dev Mode probe (T15) ──────────────────────────────────────────────────

/**
 * Non-fatal reachability check for Figma Dev Mode's local MCP endpoint.
 *
 * Issues a `GET <url>` with a hard timeout. Any response (including a
 * non-2xx status) counts as reachable — we only care that something is
 * listening on the port. Errors and timeouts return `{ reachable: false }`
 * with a brief reason for diagnostics; the function never throws.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ reachable: boolean, status?: number, reason?: string }>}
 */
export function probeDevMode(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 3000;
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { req.destroy(); } catch { /* ignore */ }
      resolve(result);
    };

    let req;
    try {
      req = http.get(url, (res) => {
        // any response → something is alive; drain and close
        res.resume();
        done({ reachable: true, status: res.statusCode });
      });
    } catch (e) {
      return resolve({ reachable: false, reason: e.message });
    }

    req.on("error", (e) => done({ reachable: false, reason: e.message }));
    const timer = setTimeout(() => done({ reachable: false, reason: "timeout" }), timeoutMs);
  });
}

// ─── Uninstall (T16) ───────────────────────────────────────────────────────

/**
 * Remove every server entry whose `_managedBy === MANAGED_SENTINEL`.
 *
 * Mutates `mcp.servers` in place. Returns `{ removed: string[] }`.
 *
 * Known limitation: a user-owned entry that happens to carry the sentinel
 * will be removed. Documented in the spec (§3.8) — the sentinel is a
 * convention, not a cryptographic claim of ownership.
 */
export function uninstallMcpServers(mcp) {
  const removed = [];
  if (!mcp || !mcp.servers) return { removed };
  for (const [name, entry] of Object.entries(mcp.servers)) {
    if (entry && entry._managedBy === MANAGED_SENTINEL) {
      delete mcp.servers[name];
      removed.push(name);
    }
  }
  return { removed };
}

/**
 * Delete the PAT file. Keep the parent directory (a user may have other
 * machine-local notes there in the future).
 */
export function deletePatFile(home, opts = {}) {
  const p = patEnvFilePath(home);
  if (!fs.existsSync(p)) return;
  if (opts.dryRun) return;
  fs.unlinkSync(p);
}
