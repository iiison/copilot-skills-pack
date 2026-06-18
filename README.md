# copilot-skills-pack

Production-grade engineering skills for **GitHub Copilot in VS Code**,
packaged as a one-command installer.

Two skill suites:

- **Core skills** — from
  [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills),
  wired into Copilot's user-level prompts so they're available in
  **every** workspace.
- **UI skills** — a built-in Figma → React workflow that turns a Figma
  frame into production-grade React/Tailwind components, including
  re-skinning of existing files behind a Preserve/Replace contract.

---

## Install

```bash
git clone https://github.com/iiison/copilot-skills-pack.git
cd copilot-skills-pack
node setup.mjs
```

Requirements: **Node 18+** and **git** on your PATH. Works on macOS,
Windows, and Linux.

> Full step-by-step (including the Figma PAT for UI skills, and per-OS
> Node/git install) → **[docs/INSTALL.md](./docs/INSTALL.md)**.

---

## What you get

After the install + an editor reload:

| Surface | Count | Activated by |
|---|---|---|
| Always-on instructions | 11 | Matching `applyTo` glob — silent |
| On-demand prompts | 10 | `#name` in chat |
| Slash commands | 14 | Type `/` in Copilot Chat |
| Chat-mode personas | 4 | Mode dropdown at top of chat panel |

Slash commands break down as:

```
Core lifecycle (7):  /spec  /plan  /implement  /test  /review  /code-simplify  /ship
UI workflow (7):     /ui-learn  /ui-mcp-status  /ui-refine  /ui-spec
                     /ui-plan   /ui-build       /ui-flag
```

Chat-mode personas: `code-reviewer`, `test-engineer`,
`security-auditor`, `frontend-craftsman`.

---

## Docs

| Doc | When to read |
|---|---|
| **[docs/INSTALL.md](./docs/INSTALL.md)** | First-time setup, OS-specific steps, Figma PAT, troubleshooting installs |
| **[docs/SKILLS_CORE.md](./docs/SKILLS_CORE.md)** | Spec → plan → build → ship lifecycle, slash commands, personas, prompt-writing rules |
| **[docs/SKILLS_UI.md](./docs/SKILLS_UI.md)** | Figma → React workflow, new-repo vs existing-repo setup, the `frontend-craftsman` persona, re-skin mode in depth |

---

## Quick examples

### Core lifecycle

```
/spec      Feature: CSV export. Reference: #file:app/api/exports/route.ts
/plan      Spec: #file:docs/exports/SPEC.md
/implement task 1 from #file:docs/exports/PLAN.md
/review my staged changes against #file:docs/exports/SPEC.md
```

### Figma → React (from scratch)

```
/ui-learn                              # one-time per repo
/ui-refine https://figma.com/file/...
/ui-spec
/ui-plan
/ui-build
```

### Figma → React (re-skin existing file)

```
/ui-refine https://figma.com/file/... --target=app/pricing/page.tsx
/ui-spec                               # produces & gets you to approve
                                       # the Preserve/Replace contract
/ui-plan
/ui-build                              # post-emit self-check enforces
                                       # the contract
```

Walk-throughs and prompt templates live in
[docs/SKILLS_UI.md](./docs/SKILLS_UI.md).

---

## Customize

Edit [`skills.config.json`](./skills.config.json) and re-run
`node setup.mjs`. You can:

- Move a skill between `alwaysOn` and `onDemand`
- Tighten / loosen any `applyTo` glob to fit your stack
- Add or remove personas
- Pin a different ref of `addyosmani/agent-skills` via `sources[].ref`

The config is the only file your team needs to fork to opinionate the
pack for their stack.

---

## Update / uninstall

```bash
# Update
cd copilot-skills-pack && git pull && node setup.mjs --yes

# Uninstall (only removes files this installer wrote)
node setup.mjs --uninstall
```

---

## How it works

1. Clones each `git` source (e.g. `addyosmani/agent-skills`) into
   `.cache/sources/<id>/` (shallow). The UI skill pack ships from the
   `local` source — files in [`local-skills/`](./local-skills/).
2. For each skill in `skills.config.json`, reads its `SKILL.md` (or
   persona file), strips its upstream frontmatter, and writes it back
   with Copilot-flavored frontmatter:
   - `*.instructions.md` for always-on (with `applyTo`)
   - `*.prompt.md` for on-demand and slash commands
   - `*.chatmode.md` for personas
3. Patches your VS Code user `settings.json` to set
   `"chat.promptFiles": true`.
4. (If you opt in) Installs the pinned `figma-developer-mcp` package,
   prompts for a Figma PAT, and registers the `figma-dev-mode` +
   `figma-framelink` MCP servers in your editor's `mcp.json`.

Per-OS prompt paths:

| OS | `User/prompts/` |
|---|---|
| macOS | `~/Library/Application Support/Code/User/prompts/` |
| Windows | `%APPDATA%\Code\User\prompts\` |
| Linux | `~/.config/Code/User/prompts/` |

---

## Credits

- Core skills, personas, and lifecycle slash commands © [Addy Osmani](https://github.com/addyosmani)
  and contributors — [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) (MIT).
- UI skills (`ui-*`, `frontend-craftsman`), installer, MCP integration,
  and configuration © 2026 [iiison](https://github.com/iiison) (MIT).

## License

MIT — see [LICENSE](./LICENSE).
