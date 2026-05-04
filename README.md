# copilot-skills-pack

Production-grade engineering skills for **GitHub Copilot in VS Code**, packaged as a one-command installer.

Built on top of [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) — this repo wires those skills into Copilot's user-level prompts folder so they're available in **every** workspace, with a sensible always-on / on-demand split.

---

## What you get

After running the installer:

| Type | Count | How it activates |
|---|---|---|
| Always-on instructions | 10 | Auto-applied to files matching their `applyTo` glob |
| On-demand prompts | 10 | Attach via `#skill-name` in Copilot Chat |
| Slash commands | 7 | Type `/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/ship` |
| Chat mode personas | 3 | `code-reviewer`, `test-engineer`, `security-auditor` |

All 20 underlying skills from `agent-skills` are installed — 10 are always-on (scoped by file type), 10 are loaded only when explicitly invoked, keeping Copilot's context lean.

---

## Install

**Requirements:** Node 18+ and `git` on your PATH. Works on **macOS, Windows, and Linux**.

```bash
git clone https://github.com/iiison/copilot-skills-pack.git
cd copilot-skills-pack
node setup.mjs
```

That's it. Reload your editor window and the skills are live.

> **New to this?** Read **[HOW_TO_USE.md](./HOW_TO_USE.md)** for a full walkthrough from idea to ship, with prompt templates for each step.

### Options

```bash
node setup.mjs --dry-run          # preview what will be written
node setup.mjs --yes              # non-interactive (accept defaults)
node setup.mjs --force            # overwrite non-managed files
node setup.mjs --target=insiders  # install into VS Code Insiders
node setup.mjs --target=cursor    # install into Cursor
node setup.mjs --target-path=/abs/path/to/User/prompts
node setup.mjs --uninstall        # remove every file this installer wrote
```

The installer auto-detects VS Code, VS Code Insiders, Cursor, and VSCodium. If multiple are present, it asks which one to target.

---

## Usage

### Slash commands (lifecycle workflow)

In Copilot Chat, type `/`:

| Command | Use when |
|---|---|
| `/spec` | Defining what to build (PRD-style) |
| `/plan` | Breaking a spec into atomic tasks |
| `/build` | Implementing a task in vertical slices |
| `/test` | Adding tests / validating behavior |
| `/review` | Five-axis review of a diff |
| `/code-simplify` | Reducing complexity while preserving behavior |
| `/ship` | Pre-launch checklist + rollout |

### Chat mode personas

Pick from the chat mode dropdown:

- **code-reviewer** — Senior staff engineer review standard
- **test-engineer** — Coverage analysis + Prove-It pattern
- **security-auditor** — OWASP / threat-modeling lens

### Always-on skills (auto-apply by file type)

| Skill | Applies to |
|---|---|
| `incremental-implementation` | every file |
| `git-workflow-and-versioning` | every file |
| `code-review-and-quality` | every file |
| `debugging-and-error-recovery` | every file |
| `test-driven-development` | `*.{ts,tsx,js,jsx,mjs,cjs}` |
| `frontend-ui-engineering` | `*.{tsx,jsx,css,scss,less}` |
| `security-and-hardening` | `**/api/**`, `**/auth/**`, `middleware*.*` |
| `spec-driven-development` | `*.md` |
| `planning-and-task-breakdown` | `*.md` |
| `documentation-and-adrs` | `*.md` |

### On-demand skills (attach via `#`)

In Copilot Chat, type `#` and pick:

```
idea-refine                source-driven-development    api-and-interface-design
context-engineering        browser-testing-with-devtools  code-simplification
performance-optimization   ci-cd-and-automation         deprecation-and-migration
shipping-and-launch
```

---

## Customize

Edit [`skills.config.json`](./skills.config.json) and re-run `node setup.mjs`. You can:

- Move a skill between `alwaysOn` and `onDemand`
- Tighten / loosen any `applyTo` glob to fit your stack
- Add or remove personas
- Pin a different ref of `addyosmani/agent-skills` via `source.ref`

The config is the only file your team needs to fork to opinionate the pack for their stack.

---

## Update

```bash
cd copilot-skills-pack
git pull
node setup.mjs --yes
```

The installer re-clones the upstream skills source into `.cache/agent-skills/` (gitignored) and rewrites only files it manages (marked with `<!-- managed-by: copilot-skills-pack -->`).

---

## Uninstall

```bash
node setup.mjs --uninstall
```

Removes only the files this installer wrote (identified by the marker comment). Your other prompts stay untouched. A backup of `settings.json` is saved as `settings.json.bak.copilot-skills-pack` the first time it's patched.

---

## How it works

1. Clones `addyosmani/agent-skills` into `.cache/agent-skills/` (shallow).
2. For each skill in `skills.config.json`, reads its `SKILL.md`, strips the upstream frontmatter, and writes it back with Copilot-flavored frontmatter:
   - `*.instructions.md` for always-on (with `applyTo`)
   - `*.prompt.md` for on-demand and slash commands
   - `*.chatmode.md` for personas
3. Patches your VS Code user `settings.json` to set `"chat.promptFiles": true`.

Per-OS install paths:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Code/User/prompts/` |
| Windows | `%APPDATA%\Code\User\prompts\` |
| Linux | `~/.config/Code/User/prompts/` |

---

## Credits

- Skills, personas, and slash commands © [Addy Osmani](https://github.com/addyosmani) and contributors — [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) (MIT)
- Installer and configuration © 2026 [iiison](https://github.com/iiison) (MIT)

## License

MIT — see [LICENSE](./LICENSE).
