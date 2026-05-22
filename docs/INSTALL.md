# Install Guide

Step-by-step setup for **copilot-skills-pack** on macOS, Windows, and Linux.

> If you only need the short version: install Node 18+ and git, then
> `git clone https://github.com/iiison/copilot-skills-pack.git && cd copilot-skills-pack && node setup.mjs`.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Step 1 — Install Node.js (18+)](#step-1--install-nodejs-18)
3. [Step 2 — Install git](#step-2--install-git)
4. [Step 3 — Install / open VS Code (or Cursor / Insiders / VSCodium)](#step-3--install--open-vs-code-or-cursor--insiders--vscodium)
5. [Step 4 — Clone and run the installer](#step-4--clone-and-run-the-installer)
6. [Step 5 — Reload your editor and verify](#step-5--reload-your-editor-and-verify)
7. [Optional: enable the Figma → React UI skills](#optional-enable-the-figma--react-ui-skills)
8. [Installer options](#installer-options)
9. [Updating](#updating)
10. [Uninstalling](#uninstalling)
11. [Where files get written](#where-files-get-written)
12. [Troubleshooting install issues](#troubleshooting-install-issues)

---

## Prerequisites

| Tool | Minimum | Used for | Verify |
|---|---|---|---|
| **Node.js** | 18.0 | running `setup.mjs` | `node --version` |
| **git** | any recent | cloning the upstream skills source | `git --version` |
| **VS Code** (or Cursor / Insiders / VSCodium) | latest | the editor that hosts Copilot Chat | open it |
| **GitHub Copilot** subscription + extension | — | required for Copilot Chat | sign in to Copilot in VS Code |

You do **not** need npm, yarn, pnpm, or any package manager installed. The installer is a single zero-dependency script (`figma-developer-mcp` is the one optional npm dep, installed only when you opt into the UI MCP setup).

---

## Step 1 — Install Node.js (18+)

Pick whichever works for your OS.

### macOS

```bash
# Recommended: via Homebrew
brew install node

# Or download the macOS installer from https://nodejs.org/en/download
```

### Windows

```powershell
# Option A: official installer
# Download from https://nodejs.org/en/download (LTS)

# Option B: winget
winget install OpenJS.NodeJS.LTS

# Option C: nvm-windows for version management
# https://github.com/coreybutler/nvm-windows
```

### Linux

```bash
# Debian / Ubuntu (NodeSource):
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora / RHEL:
sudo dnf install -y nodejs

# Or use nvm: https://github.com/nvm-sh/nvm
```

**Verify:**

```bash
node --version   # should print v18.x or higher
```

If `node --version` prints `v16` or lower, install a newer version before continuing.

---

## Step 2 — Install git

Most systems already have git. Check first:

```bash
git --version
```

If it's missing:

| OS | Command |
|---|---|
| macOS | `brew install git` *or* `xcode-select --install` |
| Windows | [git-scm.com/download/win](https://git-scm.com/download/win) *or* `winget install Git.Git` |
| Debian / Ubuntu | `sudo apt-get install -y git` |
| Fedora / RHEL | `sudo dnf install -y git` |

---

## Step 3 — Install / open VS Code (or Cursor / Insiders / VSCodium)

The installer auto-detects all four. You only need **one**.

- **VS Code:** <https://code.visualstudio.com/>
- **VS Code Insiders:** <https://code.visualstudio.com/insiders/>
- **Cursor:** <https://www.cursor.com/>
- **VSCodium:** <https://vscodium.com/>

After installing, open the editor at least once and sign in to **GitHub Copilot**. The installer needs your `User/prompts/` directory to exist; opening the editor creates it.

If you have a Copilot subscription but the chat panel doesn't show up, install the **GitHub Copilot Chat** extension from the marketplace.

---

## Step 4 — Clone and run the installer

```bash
git clone https://github.com/iiison/copilot-skills-pack.git
cd copilot-skills-pack
node setup.mjs
```

What you'll see:

1. **Editor detection.** If multiple editors are installed, the installer asks which one to target. Pick with arrow keys.
2. **Confirmation prompt.** Shows the absolute target path and asks `Proceed? (Y/n)`. Type `y` (or just hit Enter).
3. **Source sync.** Clones `addyosmani/agent-skills` into `.cache/sources/upstream/`. Subsequent runs only fetch + reset.
4. **Skill writes.** Writes one file per skill (instructions / prompt / chatmode) into `User/prompts/`.
5. **`settings.json` patch.** Sets `"chat.promptFiles": true` so VS Code surfaces the prompt files.
6. **MCP step.** Asks whether to register the Figma MCP servers — see the next section. Choose `n` if you don't want the UI skills.

If something looks wrong, hit `Ctrl-C` and re-run with `--dry-run` to preview:

```bash
node setup.mjs --dry-run
```

---

## Step 5 — Reload your editor and verify

```
Command Palette → "Developer: Reload Window"   (Cmd/Ctrl + Shift + P)
```

Then verify:

| Surface | How to check |
|---|---|
| Slash commands | Type `/` in Copilot Chat. You should see `/spec`, `/plan`, `/build`, …, plus `/ui-*` if you opted in to UI. |
| Chat modes | Click the mode dropdown at the top of the chat panel. `code-reviewer`, `test-engineer`, `security-auditor`, `frontend-craftsman` (if UI installed) should appear. |
| Always-on instructions | Open a `.tsx` file, start a chat, expand "Used N references" under the reply. The `.instructions.md` files should be listed. |

If any of those are missing, see [Troubleshooting](#troubleshooting-install-issues).

---

## Optional: enable the Figma → React UI skills

The UI skill suite needs **two Figma MCP servers** registered with VS Code:

| Server | Source | Why |
|---|---|---|
| `figma-dev-mode` | Figma desktop app (built-in) | Highest fidelity — exposes Variables + Component instances |
| `figma-framelink` | npm package `figma-developer-mcp` | Fallback when Dev Mode isn't reachable |

`node setup.mjs` handles both. When it reaches the MCP step it will:

1. Probe whether Figma desktop's Dev Mode MCP server is reachable on
   `127.0.0.1:3845`. **Non-fatal** — you can register the entry even if
   it's currently down (you'll start Figma later).
2. Install the pinned `figma-developer-mcp` package locally.
3. **Prompt for your Figma Personal Access Token (PAT)** unless one is
   already on `FIGMA_API_KEY` in your environment.
4. Write the PAT to `~/.copilot-skills-pack/.env` with mode `0600`.
5. Register both servers in your editor's `mcp.json` (with a managed
   sentinel, so the installer can safely uninstall them later).

### Getting a Figma PAT

1. Open <https://www.figma.com/settings>.
2. Scroll to **Personal access tokens** → **Generate new token**.
3. Scope: pick **File content: Read** (only read is needed).
4. Copy the token immediately — Figma only shows it once.

You can supply it three ways:

- **Environment variable** (highest precedence):
  ```bash
  export FIGMA_API_KEY=figd_xxxxxxxxxxxxxxxxxxxxxxxx
  node setup.mjs
  ```
- **File** at `~/.copilot-skills-pack/.env`. The installer writes this
  when you paste the token at the prompt.
- **Prompt** — just run `node setup.mjs` with no env var and paste when
  asked.

### Enabling Figma Dev Mode MCP (optional but recommended)

For the richest output, open the Figma desktop app and turn on:

```
Figma → Preferences → Enable local MCP Server
```

Verify the agent can reach both servers any time with the `/ui-mcp-status` slash command (see [SKILLS_UI.md](./SKILLS_UI.md#ui-mcp-status-debug-the-figma-mcp-servers)).

### Skipping MCP entirely

If you don't want the UI skills (or don't use Figma):

```bash
node setup.mjs --skip-mcp
```

Everything else still installs and the `/ui-*` commands stay dormant — they'll politely refuse with a clear message if invoked.

---

## Installer options

```text
Usage: node setup.mjs [options]

  -y, --yes              Non-interactive; accept defaults
      --dry-run          Show what would happen; write nothing
      --force            Overwrite existing files even if not managed
      --target=<id>      Editor: vscode | insiders | cursor | vscodium
      --target-path=<p>  Absolute path to a User/prompts dir (overrides detection)
      --skip-mcp         Skip the Figma MCP server registration step
      --uninstall        Remove all files written by this installer
                         (PAT file is kept by default — re-run with --force to delete)
  -h, --help             Show this message
```

Examples:

```bash
node setup.mjs --dry-run              # preview only
node setup.mjs --yes                  # CI-friendly / scripted install
node setup.mjs --target=cursor        # install into Cursor
node setup.mjs --skip-mcp             # skip Figma MCP setup
node setup.mjs --uninstall            # tear down
```

---

## Updating

```bash
cd copilot-skills-pack
git pull
node setup.mjs --yes
```

The installer is idempotent. It only rewrites files that carry the
`<!-- managed-by: copilot-skills-pack -->` marker, so hand-edited files
in your prompts dir stay untouched. Re-running is cheap.

---

## Uninstalling

```bash
node setup.mjs --uninstall
```

This:

- Removes every file in `User/prompts/` carrying the managed marker.
- Removes the `figma-dev-mode` and `figma-framelink` entries from
  `mcp.json`, **only** if they still carry the managed sentinel.
- **Keeps** `~/.copilot-skills-pack/.env` (the PAT file). To delete:

  ```bash
  rm ~/.copilot-skills-pack/.env
  ```

Your VS Code `settings.json` is **not** reverted (the `chat.promptFiles`
flag is harmless to leave on). A backup was saved as
`settings.json.bak.copilot-skills-pack` the first time it was patched —
keep or delete at your discretion.

---

## Where files get written

| OS | `User/prompts/` path |
|---|---|
| macOS | `~/Library/Application Support/Code/User/prompts/` |
| Windows | `%APPDATA%\Code\User\prompts\` |
| Linux | `~/.config/Code/User/prompts/` |
| Cursor (all OSes) | `~/.cursor/User/prompts/` (analogous) |

Other paths the installer uses:

| Path | Purpose | Tracked by git? |
|---|---|---|
| `.cache/sources/upstream/` | Shallow clone of `agent-skills` source | No |
| `local-skills/` | Source of the in-repo UI skill pack | Yes |
| `~/.copilot-skills-pack/.env` | Figma PAT (mode `0600`) | No (outside repo) |
| `<User>/mcp.json.bak.copilot-skills-pack` | One-time backup before first MCP edit | No |

---

## Troubleshooting install issues

| Symptom | Fix |
|---|---|
| `node: command not found` | Step 1 didn't take — open a fresh terminal. On Windows, sign out / back in if you used the installer. |
| `git: command not found` | Step 2 didn't take — install git and reopen the terminal. |
| Installer says it can't find an editor | Open VS Code / Cursor at least once so it creates the User dir, then re-run. Or pass `--target-path=<absolute>`. |
| `EACCES` errors writing to `User/prompts/` | The user dir is owned by another user / root. `sudo chown -R "$USER" "$HOME/Library/Application Support/Code/User/prompts"` (mac path; adapt). |
| `/spec` etc. don't appear after install | Reload the window. Then check `User/prompts/` exists and has `*.prompt.md` files. |
| Figma MCP step failed but skills installed | Skills are fine — run `node setup.mjs` again and re-attempt the MCP step. The `--skip-mcp` flag is available if you want to skip it permanently. |
| Want to start over | `node setup.mjs --uninstall` then `node setup.mjs`. |

If you hit something not in the table, please file an issue with the
output of `node setup.mjs --dry-run` and your OS / Node version.
