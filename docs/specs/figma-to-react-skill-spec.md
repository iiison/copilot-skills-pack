# Figma → React UI Skill Suite — Behavioral Spec

> **Status:** Draft v1. Source one-pager: [docs/ideas/figma-to-react-skill.md](../ideas/figma-to-react-skill.md).
>
> **Audience:** A fresh agent or human implementer. Reading only this spec must be sufficient to author every skill file, implement the `setup.mjs` extension, and reproduce the Preserve/Replace contract format byte-for-byte without re-deriving design decisions.

---

## 1. Objective

Enable a developer using GitHub Copilot in VS Code to point at a Figma frame and obtain React + TypeScript + Tailwind code that:

1. Respects the target repo's existing components, design tokens, and conventions.
2. Improves over time via a durable, repo-local conventions guide that grows with each correction.
3. Supports both **from-scratch generation** and **re-skinning of existing working code**, with the latter guarded by a mandatory Preserve/Replace contract.

The suite ships as additions to `copilot-skills-pack`, authored locally, installed alongside upstream skills via a single `node setup.mjs` invocation.

### 1.1 Non-goals (mirrored from one-pager)

- Storybook / story file generation.
- Pixel-perfect screenshot-diff verification.
- Stacks other than React + TypeScript + Tailwind.
- Auto-wiring of data fetching, routing, state management, event handlers.
- Auto-execution of slash commands from within a persona.
- Refactoring or "improving" preserved code during re-skin.
- Animation, interaction states, responsive breakpoints beyond Figma auto-layout.
- Multi-repo / cross-repo Learnings sharing.
- Upstreaming the suite to `addyosmani/agent-skills` in v1.

### 1.2 Prerequisites

The suite optimizes for **best fidelity**, which means Dev Mode MCP is the primary data source. Developers need:

| Item | Auto-installed by `setup.mjs`? | Notes |
|---|---|---|
| Node 18+ | No (already required to run `setup.mjs`) | Detected; halts with a clear message if missing. |
| Supported editor (VS Code / Insiders / Cursor / VSCodium) + Copilot extension | No | `setup.mjs` already auto-detects and asks if multiple are present. |
| Figma desktop app, signed in | No | Manual download. Required to host the Dev Mode MCP server locally. |
| Paid Figma Dev or Full seat | No | Required to enable Dev Mode. The suite still functions on a free seat via the Framelink fallback, but with reduced fidelity (no Variables, no component-instance data). |
| "Enable local MCP Server" toggled on inside Figma desktop preferences | No | One-time GUI toggle. `setup.mjs` prints the exact path. |
| `figma-developer-mcp` (Framelink fallback) | **Yes** — pinned npm install into the repo's `node_modules/` | Used automatically when Dev Mode is unreachable (e.g., Figma desktop closed). |
| Figma Personal Access Token | **Yes** (stored), **No** (generated) | User generates in Figma settings; `setup.mjs` prompts once, writes to `~/.copilot-skills-pack/.env` (mode `0600`). Required for Framelink only. |
| MCP server registration in the editor's `mcp.json` | **Yes** | Both `figma-dev-mode` and `figma-framelink` entries written; see Section 3.8. |

**Manual steps the installer surfaces but cannot perform** (Figma's product surface, not ours): downloading Figma desktop, enabling Dev Mode in its Preferences, and generating the PAT. `setup.mjs` prints the exact click path for each.

**Trade-off acknowledged:** the suite is **not** uniformly usable across all team members — free-seat developers will operate in Framelink-only mode and will see degraded deviation detection. This is a deliberate consequence of choosing fidelity over uniformity. The Learnings appendix and contract enforcement still work in both modes.

---

## 2. System Inventory

| Artifact | Path (in `copilot-skills-pack`) | Type | Activation |
|---|---|---|---|
| `frontend-craftsman` | `local-skills/agents/frontend-craftsman.md` | Persona | Chat mode dropdown |
| `ui-conventions` | `local-skills/skills/ui-conventions/SKILL.md` | Always-on instruction | `applyTo: **/*.{tsx,ts,css}` |
| `ui-learn` | `local-skills/skills/ui-learn/SKILL.md` | Slash command | `/ui-learn` |
| `ui-refine` | `local-skills/skills/ui-refine/SKILL.md` | Slash command | `/ui-refine` |
| `ui-spec` | `local-skills/skills/ui-spec/SKILL.md` | Slash command | `/ui-spec` |
| `ui-plan` | `local-skills/skills/ui-plan/SKILL.md` | Slash command | `/ui-plan` |
| `ui-build` | `local-skills/skills/ui-build/SKILL.md` | Slash command | `/ui-build` |
| `ui-flag` | `local-skills/skills/ui-flag/SKILL.md` | Slash command | `/ui-flag` |
| `ui-mcp-status` | `local-skills/skills/ui-mcp-status/SKILL.md` | Slash command | `/ui-mcp-status` |

Plus, generated **inside the target repo** by the skills:

| Artifact | Path | Tracked in git? | Produced by |
|---|---|---|---|
| Repo UI guide | `docs/ui/repo-ui-guide.md` | Yes (committed) | `/ui-learn`, updated by mid-build corrections |
| Session state | `docs/ui/.session-state.json` | **No** (gitignored) | All `/ui-*` commands read/write |

Slash commands resolve via a single naming convention: `slashCommands[].name === "<stem>"` ↔ `local-skills/skills/<stem>/SKILL.md`. Instructions and on-demand prompts use the same path layout — only their slot in `skills.config.json` determines how `setup.mjs` wraps them.

---

## 3. `setup.mjs` Extension Contract

### 3.1 New `skills.config.json` schema

```jsonc
{
  "sources": [
    {
      "id": "upstream",
      "type": "git",
      "repo": "https://github.com/addyosmani/agent-skills.git",
      "ref": "main"
    },
    {
      "id": "local",
      "type": "local",
      "path": "./local-skills"
    }
  ],
  "alwaysOn": [
    {
      "name": "incremental-implementation",
      "source": "upstream",
      "applyTo": "**",
      "note": "..."
    },
    {
      "name": "ui-conventions",
      "source": "local",
      "applyTo": "**/*.{tsx,ts,css}",
      "note": "Inject the repo UI guide into context for any UI file."
    }
  ],
  "onDemand":      [{ "name": "idea-refine",         "source": "upstream" }],
  "slashCommands": [
    { "name": "spec",     "source": "upstream" },
    { "name": "ui-build", "source": "local"    }
  ],
  "personas": [
    { "name": "code-reviewer",       "source": "upstream" },
    { "name": "frontend-craftsman",  "source": "local" }
  ]
}
```

**Rules:**

- `sources[]` is required. Must contain at least one entry. Each entry has `id` (unique string), `type` (`"git"` or `"local"`), and the type-specific fields below.
- `type: "git"` requires `repo` (URL) and `ref` (branch / tag / SHA).
- `type: "local"` requires `path` (filesystem path relative to `copilot-skills-pack` root).
- `source` on a skill entry is **optional**. When omitted, defaults to `"upstream"` (the first source with `id: "upstream"`, or the first source overall if no `"upstream"` exists).
- `onDemand`, `slashCommands`, and `personas` arrays may contain either bare strings (legacy) or objects `{ name, source }`. Bare strings auto-coerce to `{ name: <string>, source: "upstream" }`.

### 3.2 Backward-compatibility migration

On first run after upgrade, `setup.mjs` detects the legacy config shape — identified by either:

- A top-level `source` object (singular) instead of `sources` (array), OR
- Bare string entries in `onDemand`, `slashCommands`, or `personas`.

Migration steps (in order):

1. Write `skills.config.json.bak.copilot-skills-pack` once (skip if backup already exists).
2. Rewrite the config in place:
   - `source` (object) → `sources: [{ id: "upstream", type: "git", ...oldSource }]`.
   - Bare strings in arrays → `{ name, source: "upstream" }`.
3. Log: `ℹ Migrated skills.config.json to multi-source schema (backup at .bak.copilot-skills-pack).`
4. Continue with the install using the migrated config.

Re-runs against an already-migrated config are no-ops.

### 3.3 Source resolution

```
function resolveSourceDir(sources, sourceId) {
  // sourceId defaults to "upstream" upstream when omitted on a skill entry.
  const src = sources.find(s => s.id === sourceId);
  if (!src) throw new Error(`Unknown source id: ${sourceId}`);
  if (src.type === "git")   return /* cached clone path: .cache/sources/<id>/ */;
  if (src.type === "local") return /* path.resolve(ROOT, src.path) */;
}
```

- Multiple `git` sources each get their own cache directory under `.cache/sources/<id>/`. The existing `.cache/agent-skills/` becomes `.cache/sources/upstream/` post-migration (one-time rename, idempotent).
- `local` sources are not cloned; they are read directly from the workspace.

### 3.4 Skill file resolution

For a skill entry `{ name, source }` of any kind (always-on / on-demand / slash / persona):

| Kind | File expected at |
|---|---|
| `alwaysOn` | `<sourceDir>/skills/<name>/SKILL.md` |
| `onDemand` | `<sourceDir>/skills/<name>/SKILL.md` |
| `slashCommands` | `<sourceDir>/skills/<name>/SKILL.md` for `local` sources; `<sourceDir>/.claude/commands/<name>.md` or `<sourceDir>/.gemini/commands/<name>.md` for `git` sources (preserves current upstream behavior) |
| `personas` | `<sourceDir>/agents/<name>.md` |

If the file is missing, `setup.mjs` logs a warning and skips that entry. No fatal error — preserves current resilience.

### 3.5 Name collision policy

If two skills across different sources declare the same `name` in the same array (e.g., both `upstream` and `local` define a slash command named `build`), the **later entry in the array wins**. Because users edit `skills.config.json` directly, this gives them explicit ordering control.

`setup.mjs` emits a warning per collision: `⚠ slashCommand 'build' defined by both 'upstream' and 'local'; using 'local' (path: ./local-skills/skills/build/SKILL.md).`

### 3.6 Marker comment & uninstall semantics

Unchanged from current behavior. Every generated file in the target prompts dir contains `<!-- managed-by: copilot-skills-pack -->`. `--uninstall` removes any file containing the marker, regardless of source.

### 3.7 Acceptance criteria (`setup.mjs` extension)

- [ ] Running `setup.mjs` against a legacy config (singular `source` object and/or bare string entries) produces `skills.config.json.bak.copilot-skills-pack` once and rewrites the original to the multi-source schema.
- [ ] Running `setup.mjs` a second time against an already-migrated config is a no-op (no new backup, no rewrite).
- [ ] A skill entry with no `source` field resolves to the source whose `id` is `"upstream"`. If no source has that id, the first entry in `sources[]` is used and a warning is logged.
- [ ] A `type: "local"` source resolves files from `path.resolve(ROOT, src.path)` without cloning.
- [ ] A `type: "git"` source clones into `.cache/sources/<id>/` (each git source gets its own subdirectory).
- [ ] The legacy `.cache/agent-skills/` directory is renamed to `.cache/sources/upstream/` on first migrated run; subsequent runs are no-ops.
- [ ] Two skills in the same array with the same `name` from different sources produce a warning naming both sources; the later-listed entry's source wins.
- [ ] A skill referencing a missing `source` id throws with `Unknown source id: <id>`.
- [ ] A skill whose source file is missing logs a warning and is skipped (no fatal error).
- [ ] `--uninstall` removes all files containing the marker comment regardless of which source they came from.

### 3.8 MCP installation contract

`setup.mjs` registers two Figma MCP servers in the editor's `mcp.json`: **Dev Mode (primary)** and **Framelink (fallback)**. Runtime selects whichever is reachable; the developer does not choose explicitly.

#### 3.8.1 What `setup.mjs` does

1. **Resolves the editor's MCP config path** based on the chosen `--target`:
   - VS Code / Insiders / VSCodium: `<userDir>/mcp.json` (sibling of `settings.json`).
   - Cursor: `~/.cursor/mcp.json`.
2. **Reads `mcp.json`** as JSONC. If absent, creates `{ "servers": {} }`. If present and unparsable, halts with a pointer to the file (no mutation).
3. **Backs up once** to `mcp.json.bak.copilot-skills-pack` if any mutation is needed.
4. **Registers `figma-dev-mode`** with type `sse` and URL `http://127.0.0.1:3845/sse` (the canonical Dev Mode endpoint).
5. **Installs `figma-developer-mcp`** at a version pinned in this repo's `package.json` into `node_modules/`. Not global. Bumps require a deliberate commit.
6. **Prompts once for the Figma Personal Access Token** unless `FIGMA_API_KEY` is already in the environment. Writes the token to `~/.copilot-skills-pack/.env` with mode `0600`. Skipped on subsequent runs once the file exists.
7. **Registers `figma-framelink`** with type `stdio`, command `node`, args pointing at the pinned `figma-developer-mcp` binary, and `env: { "FIGMA_API_KEY": "${env:FIGMA_API_KEY}" }`. The env file is sourced via the editor's environment-file convention or via shell rc — installer prints the recommended snippet.
8. **Validates reachability** of Dev Mode with a 3-second timeout against `http://127.0.0.1:3845/sse`. If unreachable, prints a yellow warning + the two-step enable instructions; does **not** fail the install (devs may enable later).
9. **Idempotent re-runs** — a second invocation produces no new backup or mutation when both server entries are present with the expected fields.

#### 3.8.2 What `setup.mjs` cannot automate

These live on Figma's product surface and are surfaced by the installer's `printNextSteps` output and the README troubleshooting page (Section 9):

- Downloading the Figma desktop app.
- Toggling "Enable local MCP Server" inside Figma desktop preferences.
- Generating the Personal Access Token (the user creates it; setup only stores it).
- Provisioning a paid Dev or Full Figma seat.

#### 3.8.3 Uninstall

`node setup.mjs --uninstall` additionally:

1. Removes the `figma-dev-mode` and `figma-framelink` entries from `mcp.json`, preserving any other servers.
2. Prompts: *"Also delete the PAT at `~/.copilot-skills-pack/.env`? (y/N)"*. Defaults to keeping the file so re-install can reuse it.
3. Does **not** uninstall `node_modules/` (npm hygiene is the user's call).

#### 3.8.4 Acceptance criteria

- [ ] First run on a clean machine: produces one `mcp.json.bak.copilot-skills-pack`, writes both server entries, installs the pinned npm package, prompts for PAT, writes `~/.copilot-skills-pack/.env` with mode `0600`.
- [ ] Second run with no changes: no new backup, no rewrite, no PAT prompt, exits cleanly.
- [ ] Dev Mode reachability check is non-fatal — install succeeds even if Figma desktop is closed.
- [ ] An invalid `mcp.json` halts with a pointer to the file and writes nothing.
- [ ] `--uninstall` removes only the two managed server entries; preserves other entries in `mcp.json`.
- [ ] The PAT is never echoed to stdout, never written to any log path, never copied to the workspace.
- [ ] If `FIGMA_API_KEY` is already in `process.env`, the PAT prompt is skipped and the env file is not written.

---

## 4. Skill File Specifications

For each skill below, the spec defines: **Frontmatter**, **Inputs**, **Preconditions**, **Behavior**, **Outputs**, **Failure modes**, **Session-state interactions**, **Behavioral example**.

> **Convention:** Filenames inside `local-skills/skills/<name>/SKILL.md` always match the slash command name. Slash command `/ui-build` ↔ `local-skills/skills/ui-build/SKILL.md`.

### 4.1 Persona — `frontend-craftsman`

**Path:** `local-skills/agents/frontend-craftsman.md`

**Frontmatter (added by installer):**
```yaml
---
description: "Persona: frontend-craftsman"
---
```

**Body must include:**

1. **Identity statement.** "You are a senior frontend engineer specializing in translating Figma designs into production React + TypeScript + Tailwind components. You think in terms of design tokens, component reuse, and codebase consistency."

2. **First-turn behavior.** On the first user turn in this mode, check whether `docs/ui/repo-ui-guide.md` exists in the workspace (via the always-on instruction's injected context). If absent, output exactly: *"I don't see `docs/ui/repo-ui-guide.md` yet. Before we generate any UI, run `/ui-learn` so I can scan your repo and capture conventions. Future sessions and teammates will reuse it."* Then stop. Do not generate code.

3. **Slash-command recommendation table.** The persona body must contain a table the agent uses to suggest commands:

   | Trigger signal | Recommended command |
   |---|---|
   | User pastes a Figma URL with no prior `/ui-refine` | `/ui-refine <url>` |
   | User asks "build this design" and a refinement exists | `/ui-spec` then `/ui-plan` then `/ui-build` |
   | User wants to replace existing UI with a Figma design | `/ui-refine <url> --target=<path>` |
   | User asks "is this design consistent with our system?" | `/ui-flag <url>` |
   | Repo has no `docs/ui/repo-ui-guide.md` | `/ui-learn` (before anything else) |

   The persona never executes commands; it recommends and waits.

4. **Mid-correction learning rule.** Verbatim instruction the persona must include:

   > After any user correction that contradicts how you just generated UI — signals include phrases like "we use X not Y", "that's wrong", "use our X instead", "don't do it that way" — offer exactly once: *"Should I log this as a learning to `docs/ui/repo-ui-guide.md`? (y/n)"*. If the user agrees, append a structured entry to the `## Learnings` section of the guide using the format in Section 6.1. Do not re-ask within the same correction thread (defined as: the same logical disagreement, regardless of how many turns it spans).

5. **Discoverability hint.** On any UI-related first message, append: *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to any `/ui-refine` or `/ui-build` invocation to re-skin existing code instead of generating from scratch. Pass `--task=<N>` to `/ui-build` to jump to a specific task in the plan."*

6. **Out-of-scope guardrails.** The persona must refuse to:
   - Modify data fetching, routing, or state-management code unless it is purely cosmetic (e.g., re-ordering JSX inside a `.map()`).
   - Generate non-Tailwind styling.
   - Suggest non-React frameworks even when asked. Respond: *"This persona is scoped to React + TypeScript + Tailwind. Switch persona or fork the skill suite for other stacks."*

#### Acceptance criteria
- [ ] Fresh chat in `frontend-craftsman` mode, no `repo-ui-guide.md` present → first agent turn recommends `/ui-learn` and stops.
- [ ] User pastes a Figma URL → agent recommends `/ui-refine <url>` (without executing).
- [ ] After a contradictory correction, agent offers exactly one learning-log prompt per disagreement.
- [ ] Agent refuses to generate Vue/Svelte/MUI code with the documented refusal message.

---

### 4.2 Always-on instruction — `ui-conventions`

**Path:** `local-skills/skills/ui-conventions/SKILL.md`

**Frontmatter (added by installer):**
```yaml
---
applyTo: "**/*.{tsx,ts,css}"
description: "Inject the repo UI guide into context for any UI file."
---
```

**Body must include:**

1. **Read-first rule.** *"Before generating, modifying, or reviewing any React/TypeScript/Tailwind UI code, read `docs/ui/repo-ui-guide.md` from the workspace root if it exists. Treat it as authoritative on component reuse, token usage, naming conventions, and the Learnings appendix. If it does not exist, recommend running `/ui-learn` before generating UI."*

2. **Token-discipline rule.** *"Do not introduce hardcoded color values, spacing values, or font sizes when the guide identifies tokens for them. Use the guide's token map. If a needed token is missing, flag it to the developer rather than inventing a value."*

3. **Component-reuse rule.** *"Before creating a new component, check the guide's Component Inventory. If an existing component covers the use case (even with minor extensions), reuse it. If you create a new primitive, note it for inclusion in the next `/ui-learn` pass."*

4. **Learnings-respect rule.** *"The guide's Learnings appendix is binding. If a learning says 'we use Stack not flex divs', do not emit flex divs even if the design appears to use them."*

5. **Out-of-scope guardrail.** *"This instruction only applies to UI generation/modification. Do not block or modify non-UI code."*

#### Acceptance criteria
- [ ] In a chat with a `.tsx` file open and no `repo-ui-guide.md`, the agent surfaces a recommendation to run `/ui-learn` when asked to write UI.
- [ ] In a repo with a guide that maps `bg-primary` to `hsl(220 90% 50%)`, the agent does not emit `bg-[#3366ff]`.
- [ ] In a non-UI file (e.g., `server.ts`), this instruction does not affect output.

---

### 4.3 `/ui-learn`

**Path:** `local-skills/skills/ui-learn/SKILL.md`

**Frontmatter (added by installer):**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-learn"
---
```

#### Inputs
- None required.
- Optional: a comma-separated list of additional doc paths the dev wants the agent to consider (e.g., `/ui-learn docs/design-system.md, https://internal.notion/ui`).

#### Preconditions
- Workspace is a code repo (presence of `package.json` or `.git/`).

#### Behavior

1. Emit intro: *"Scanning your repo to capture UI conventions. I'll ask a few targeted questions, then produce `docs/ui/repo-ui-guide.md`."* Plus the `--target` discoverability hint.

2. **Scan phase (read-only):**
   - `package.json` — detect: React version, TypeScript, Tailwind, shadcn/ui, testing libraries.
   - `tailwind.config.*` and any CSS files with `@tailwind`/`@theme` directives — extract custom colors, spacing, fonts.
   - `src/components/**`, `app/components/**`, `components/**`, `ui/**` (whichever exist) — list components with their file paths and exported names.
   - Files matching `tokens.*`, `theme.*`, `design-tokens.*` — capture token definitions.
   - `src/**/*.test.{ts,tsx}`, `**/__tests__/**` — detect test file convention (co-located vs `__tests__/` folder).
   - Any markdown files in `docs/ui/`, `docs/design/`, `STYLE.md`, `CONTRIBUTING.md` — flag for human review, not auto-included.

3. **Question phase.** Ask 4–6 targeted questions based on scan results. Examples:
   - "I see shadcn/ui in package.json. Is `components/ui/*` your primitive layer?"
   - "Found `tokens.ts` with 32 color variables. Treat as the authoritative token map?"
   - "No `Stack`/`Inline` layout primitives detected. Want me to flag designs that need them?"
   - "Tests are colocated as `*.test.tsx`. Confirm this convention for generated tests?"
   - Skip questions whose answer is unambiguous from the scan.

4. **Greenfield branch.** If the scan finds zero existing components AND no Tailwind config AND no tokens:
   - Emit the **starter template** (Section 6.1.1) with the top banner: *"⚠ STARTER GUIDE — please review and edit before committing. Defaults shown below."*
   - Set `state.preferences.starterGuideAccepted = false`.
   - Do not proceed to `/ui-refine` until either the file is edited (mtime change) or the dev explicitly types `use defaults`.

5. **Write phase:**
   - Write `docs/ui/repo-ui-guide.md` per the template in Section 6.1.
   - Create `docs/ui/.session-state.json` per Section 6.2 if it doesn't exist, with default values.
   - Append `docs/ui/.session-state.json` to `.gitignore` if not already present. Show diff and confirm before writing.

6. **Closing prompt:** *"Done. Review the guide and commit it (`git add docs/ui/repo-ui-guide.md && git commit -m 'docs: capture UI conventions'`). Future sessions and teammates will read this before generating any UI."*

#### Outputs
- `docs/ui/repo-ui-guide.md` (committed).
- `docs/ui/.session-state.json` (gitignored).
- `.gitignore` updated (with confirmation).

#### Failure modes
- Workspace root not detectable → halt, output: *"Couldn't locate a repo root. Open the workspace folder and retry."*
- `docs/ui/repo-ui-guide.md` already exists → ask: *"A guide exists. Refresh from scan (overwrite Inventory/Token sections, preserve Learnings) or cancel?"* Default: cancel.
- Multiple plausible primitive locations (e.g., both `components/` and `ui/`) → ask the dev to choose.

#### Session-state interactions
- **Writes:** `preferences.testingLibrary`, `preferences.testFileConvention`, `preferences.primitivesPath`, `preferences.tokensPath`, `preferences.starterGuideAccepted`.
- **Reads:** none on first run; on re-run, reads existing preferences to skip already-answered questions.

#### Behavioral example
```
User: /ui-learn
Agent: Scanning your repo… Found React 18, TypeScript, Tailwind 3,
       shadcn/ui in components/ui/, tokens.ts with 24 colors.
       Two questions:
       1) Is components/ui/ your primitive layer? (Y/n)
       2) Tests co-located as *.test.tsx? (Y/n)
User: y, y
Agent: Wrote docs/ui/repo-ui-guide.md.
       Created docs/ui/.session-state.json (gitignored).
       Appending docs/ui/.session-state.json to .gitignore — confirm? (Y/n)
User: y
Agent: Done. Commit the guide so teammates and future sessions can read it.
```

#### Acceptance criteria
- [ ] On a mid-maturity repo, produces a guide with populated Inventory and Token Map sections, ≤6 questions asked.
- [ ] On a greenfield repo, emits starter template with banner and refuses to proceed without explicit acceptance.
- [ ] On re-run with existing guide, asks whether to refresh (default cancel).
- [ ] Adds `.session-state.json` to `.gitignore` after confirmation.

---

### 4.4 `/ui-refine`

**Path:** `local-skills/skills/ui-refine/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-refine"
---
```

#### Inputs
- **Required:** A Figma URL (frame, section, or page).
- **Optional:** `--target=<workspace-relative-path>` or `#file:<path>` attachment to enter **re-skin mode**. If both are present, they must reference the same path; if they disagree, halt and ask.

#### Preconditions
- `docs/ui/repo-ui-guide.md` exists. If missing, halt and recommend `/ui-learn`.
- `state.preferences.starterGuideAccepted !== false`. If `false` (greenfield path where the dev has not edited the starter guide or typed `use defaults`), halt with: *"The starter guide hasn't been accepted yet. Edit `docs/ui/repo-ui-guide.md` or type `use defaults` and re-run `/ui-learn` to confirm before refining."*
- At least one Figma MCP server is reachable. The agent calls `figma-dev-mode` first (richest fidelity — Variables and component instances); if its tools error or time out, it transparently falls back to `figma-framelink`. If both fail, halt with: *"No Figma MCP server reachable. Open Figma desktop with Dev Mode enabled (Preferences → Enable local MCP Server), or verify `FIGMA_API_KEY` is set for the Framelink fallback. Run `node setup.mjs` to (re)install. Diagnose with `/ui-mcp-status`."*

#### Behavior

1. Emit intro with the `--target` discoverability hint.

2. **Fetch phase:** Call Figma MCP to retrieve the frame. Capture: node tree, Variables, component instances, auto-layout metadata.

3. **Detection phase:**
   - Mode = `from-scratch` if no target; `re-skin` if target present.
   - In re-skin mode, also read the target file.

4. **Breakdown phase (conversational):**
   - Propose a component tree: which Figma elements are primitives (reuse), composed (compose primitives), and the page-level shell (if applicable).
   - For each candidate primitive that *looks like* an existing component in the guide's Inventory but is **not** a Component instance in Figma, **flag the deviation per the session's `preferences.deviationPolicy`**:
     - `flag-and-ask` (default): show side-by-side, ask: *"Substitute existing `Button` for this Figma rectangle? (y/n/keep-asking)"*. If "keep-asking", remain in this policy. If a one-time-only answer for this frame is given, persist nothing.
     - `auto-substitute`: substitute and note in output.
     - `as-drawn`: generate as-drawn, warn once at the end.
   - Iterate with the dev until the breakdown is approved.

5. **Re-skin branch (if `--target` is set):**
   - Read the target file. Parse top-level statements via LLM inspection (acknowledged: not AST-deterministic).
   - Enumerate every conditional branch in the existing JSX. For each branch, ask the dev which Figma state it maps to. Unmapped branches stay in PRESERVE.
   - Build a draft of the Preserve/Replace contract (Section 6.3). Do not finalize — that happens in `/ui-spec`.
   - Set `state.inProgress.mode = "re-skin"` and `state.inProgress.target = <path>`.

6. **Close:**
   - Save the approved breakdown to `docs/ui/refinements/<frame-slug>.md` (committed; small markdown file).
   - Update `state.inProgress`: `{ figmaUrl, frameSlug, phase: "refined", componentTree, deviations, ...mode info }`.
   - Emit: *"Refinement complete. Run `/ui-spec` to produce component specs."*

#### Outputs
- `docs/ui/refinements/<frame-slug>.md` — component tree, deviations list, optional re-skin draft contract.
- Updates to `docs/ui/.session-state.json`.

#### Failure modes
- Figma MCP unreachable / URL invalid → halt, suggest checking MCP config.
- Dev Mode MCP unavailable, Framelink fallback active → continue but emit warning: *"Framelink fallback active — Component instance and Variables data are not available. Open Figma desktop with Dev Mode enabled for full fidelity."*
- Both MCP servers unreachable → halt per the precondition message above. Do not attempt manual screenshot interpretation as a substitute.
- Target file (re-skin mode) does not exist → halt and ask whether the dev meant a different path.
- Conflicting `--target` and `#file:` paths → halt and ask which to use.

#### Session-state interactions
- **Reads:** `preferences.deviationPolicy`, `preferences.primitivesPath`.
- **Writes:** `preferences.deviationPolicy` (on first answer), `inProgress.*`.

#### Behavioral example (re-skin)
```
User: /ui-refine https://figma.com/file/abc/Pricing?node-id=12-34 --target=app/pricing/page.tsx
Agent: Reading Figma + app/pricing/page.tsx…
       Component tree proposal:
         PricingPage (re-skin target)
         ├── PricingTier (new — composed)
         │   ├── Button   (reuse from components/ui)
         │   └── Stack    (reuse)
         └── Badge        (deviation: Figma uses raw rect, we have Badge)
       Deviation: 1. Substitute Badge for the Figma rectangle in "Most Popular"? (y/n/keep-asking)
User: y
Agent: Existing JSX branches I see in page.tsx:
        1. isLoading → <Skeleton/> (no Figma equivalent — PRESERVE)
        2. error     → <ErrorBanner/> (Figma shows a Toast instead — UNCERTAIN, please confirm)
        3. data      → render tiers (REPLACE with new structure)
User: keep ErrorBanner for now, don't switch to Toast
Agent: Logged. Refinement saved to docs/ui/refinements/pricing-page.md.
       Run /ui-spec next.
```

#### Acceptance criteria
- [ ] Without `--target`, produces a from-scratch component tree.
- [ ] With `--target`, additionally produces an enumerated branch list and a draft contract.
- [ ] Deviation policy is respected and persisted when changed.
- [ ] Saves refinement artifact and updates session state.

---

### 4.5 `/ui-spec`

**Path:** `local-skills/skills/ui-spec/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-spec"
---
```

#### Inputs
- None — reads from `state.inProgress` and the refinement artifact.
- Optional: explicit refinement slug if multiple are in progress.

#### Preconditions
- `state.inProgress.phase === "refined"` (i.e., `/ui-refine` ran successfully).
- The corresponding `docs/ui/refinements/<slug>.md` exists.

#### Behavior

1. Load refinement + repo guide.

2. **Per-component spec:** For each component identified in `/ui-refine`, produce a spec block containing:
   - **Name** and target file path (proposed).
   - **Props interface** with TypeScript types.
   - **Variants** (e.g., `size`, `tone`) with explicit value sets.
   - **States** (default, hover, focus, disabled, loading — only those expressed in Figma).
   - **Tokens used** (mapped from Figma Variables to guide's Token Map).
   - **Reuse declaration** — which existing components it imports.
   - **Accessibility notes** — semantic element (`<button>` vs `<div role="button">`), required ARIA, keyboard interactions.

3. **From-scratch mode:** emit specs only. Done.

4. **Re-skin mode (additional steps):**
   - Promote the draft Preserve/Replace contract from `/ui-refine` to a final contract.
   - Run the **self-check enumeration** (Section 6.3.2): list every top-level statement in the target file and which bucket (PRESERVE / REPLACE / UNCERTAIN) it landed in. Verify no statement is unaccounted for.
   - Resolve all UNCERTAIN entries by asking the dev one at a time. Each answer moves the entry to PRESERVE or REPLACE.
   - After zero UNCERTAINs remain, write the final contract to `docs/ui/contracts/<slug>.md`.
   - Ask: *"Approve this Preserve/Replace contract? `/ui-build` will not run without your approval. (approve / revise)"*. On approve, set `state.inProgress.contractApproved = true`. On revise, loop back.

5. Close:
   - Write per-component specs to `docs/ui/specs/<slug>.md` (committed).
   - Update `state.inProgress.phase = "spec'd"`.
   - Emit: *"Specs ready. Run `/ui-plan` next."*

#### Outputs
- `docs/ui/specs/<slug>.md` — committed.
- `docs/ui/contracts/<slug>.md` — committed when in re-skin mode.

#### Failure modes
- No `inProgress` refinement → halt and recommend `/ui-refine`.
- Self-check finds an unaccounted statement → halt, surface the omission, ask the dev to assign it.
- Dev refuses to approve contract after 3 revisions → halt and ask whether to abort the workflow.

#### Session-state interactions
- **Reads:** all of `inProgress`, `preferences.tokensPath`.
- **Writes:** `inProgress.contractApproved`, `inProgress.phase`.

#### Behavioral example
```
User: /ui-spec
Agent: Loaded refinement: pricing-page.
       PricingTier:
         Props: { tier: 'free' | 'pro' | 'enterprise'; price: string; ctaLabel: string; isPopular?: boolean }
         Variants: tone = ['default','featured']
         Tokens: bg → tokens.surface.subtle, border → tokens.border.default
         Reuse: Stack, Button, Badge
         A11y: <article role="region" aria-label={tier}>
       Re-skin contract self-check (app/pricing/page.tsx, 14 top-level statements):
         ✓ All accounted for. 0 UNCERTAIN remaining.
       Approve the Preserve/Replace contract? (approve / revise)
User: approve
Agent: Contract saved to docs/ui/contracts/pricing-page.md.
       Run /ui-plan next.
```

#### Acceptance criteria
- [ ] Produces a spec block per component with all required subsections.
- [ ] In re-skin mode, runs self-check and surfaces any unaccounted statements.
- [ ] Halts if contract is not approved.
- [ ] Writes committed artifacts and updates session state.

---

### 4.6 `/ui-plan`

**Path:** `local-skills/skills/ui-plan/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-plan"
---
```

#### Inputs
- None — reads from session state and prior artifacts.

#### Preconditions
- `state.inProgress.phase === "spec'd"`.

#### Behavior

1. Produce a numbered task list, each task being a single component (or the page shell) with:
   - **File path** (resolved against the guide's primitives path, the spec's proposed path, and the target file for re-skin).
   - **Reuse imports** — list of existing components/tokens imported.
   - **New primitives needed** — listed separately so the dev can decide whether to merge into the existing primitive layer.
   - **Build order** — topologically sorted: leaves before composites, page shell last.
   - **Acceptance criteria** — testable.
   - **Re-skin annotation** (if applicable) — references the contract section governing this task.

2. Emit ordered list to chat. Save to `docs/ui/plans/<slug>.md`.

3. Update `state.inProgress.phase = "planned"`, `state.inProgress.tasks = [...]`, `state.inProgress.currentTaskIndex = 0`.

4. Emit: *"Plan ready. Run `/ui-build` to start (begins at task 1)."*

#### Outputs
- `docs/ui/plans/<slug>.md` — committed.

#### Failure modes
- No spec'd refinement in progress → halt and recommend `/ui-spec`.
- Build order has a cycle (composites referencing each other) → halt, surface the cycle, ask the dev to break it.

#### Session-state interactions
- **Reads:** `inProgress.*`.
- **Writes:** `inProgress.phase`, `inProgress.tasks`, `inProgress.currentTaskIndex`.

#### Behavioral example
```
User: /ui-plan
Agent: Plan for pricing-page (re-skin):
       1. components/ui/Badge.tsx — already exists, no work needed.
       2. components/pricing/PricingTier.tsx — new. Imports: Stack, Button, Badge.
          A/C: matches PricingTier spec; props type matches; no token violations.
       3. app/pricing/page.tsx — re-skin per contracts/pricing-page.md.
          A/C: PRESERVE list untouched (verified by self-check); REPLACE list
               fully replaced; no UNCERTAIN entries remain.
       Saved to docs/ui/plans/pricing-page.md. Run /ui-build to start.
```

#### Acceptance criteria
- [ ] Tasks are topologically sorted and individually testable.
- [ ] In re-skin mode, the page-shell task references the contract.
- [ ] Saves committed artifact and updates `inProgress.tasks` + `currentTaskIndex`.

---

### 4.7 `/ui-build`

**Path:** `local-skills/skills/ui-build/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-build"
---
```

#### Inputs
- None — uses session state.
- Optional: `--task=<N>` where N is the 1-based task index from `docs/ui/plans/<slug>.md`. Jumps to that task instead of using `state.inProgress.currentTaskIndex`.
  - If N exceeds the plan's task count, halt: *"Task <N> doesn't exist. The plan has <total> tasks (1–<total>). Run `/ui-plan` if you've added new tasks."*
  - If task N is already built (its target file exists and substantively matches the plan's acceptance criteria for that task), halt: *"Task <N> appears already built (file `<path>` exists and matches the plan). Pass `--task=<N> --force` to rebuild, or pick a different task."*
  - `--force` (alongside `--task=<N>`) suppresses the already-built check.
- Optional: `--target=<path>` is **ignored** here; re-skin mode is determined by the contract presence, not a flag at build time. If supplied, agent confirms it matches the contract's target and proceeds.

#### Preconditions
- `state.inProgress.phase === "planned"`.
- **If re-skin mode**: `state.inProgress.contractApproved === true` AND `docs/ui/contracts/<slug>.md` exists.

#### Behavior

1. **Mandatory gate (re-skin only).** Before any generation, re-read the contract file from disk (not from session state — the file is the source of truth). If missing or `contractApproved !== true`, halt with:

   > **`/ui-build` halted.** Re-skin mode requires an approved Preserve/Replace contract. Run `/ui-spec` first and approve the contract before retrying.

2. **First-run preference checks.** If `state.preferences.generateTests === null` (unasked), ask: *"Generate tests for components in this build? (y/n)"*. Persist the answer.

3. **For each task** starting at `currentTaskIndex`:

   a. Re-read the relevant spec, plan task, and (if re-skin) the contract.

   b. **Pre-emit self-check (re-skin only).** Re-read the target file from disk. For each top-level statement in PRESERVE, identify its exact byte range. Mentally hold this as "do-not-touch."

   c. **Generate the file.** Apply repo guide token discipline and reuse rules. Emit the file content.

   d. **Post-emit self-check (re-skin only).** Diff the generated content against the original target file. For every changed line, verify it falls within a REPLACE range, not a PRESERVE range. If a PRESERVE range was touched, halt with:

      > **Contract violation detected.** Generation would modify a PRESERVE range:
      > `<file>:<line-start>-<line-end>` — original: `<snippet>`
      > This is forbidden. Aborting this task. Re-run `/ui-spec` to revise the contract or amend the design.

      Acknowledge this is LLM-enforced (Section 8.4); the diff check is the agent reasoning over text, not a deterministic tool.

   e. **Test generation (if opted in).** Generate `<Component>.test.tsx` using the testing library and convention identified by `/ui-learn` (defaults: vitest + @testing-library/react, co-located).

   f. **Commit prompt.** Output: *"Task N complete. Stage and commit? Suggested message: `feat(ui): add <ComponentName>` (or `style(ui): re-skin <file> per contract`). Then run `/ui-build` again for task N+1."* Do not run git commands; the dev does.

   g. Update `state.inProgress.currentTaskIndex++`. If last task, set `phase = "built"` and emit a summary.

#### Outputs
- One or more `.tsx` files at paths defined by `/ui-plan`.
- Optional `.test.tsx` files alongside (or in `__tests__/`, per repo convention).
- Updated `state.inProgress`.

#### Failure modes
- Preconditions not met → halt with the gate message.
- Contract violation in re-skin → halt with the violation message; do not write the file.
- Tailwind config doesn't include a referenced token → emit the file but flag the missing token at top of chat output with a `// TODO: add token <name>` comment in the generated file.
- Dev interrupts mid-build (next message contradicts the just-emitted file) → trigger the mid-correction learning rule from the persona (Section 4.1 item 4).

#### Session-state interactions
- **Reads:** `inProgress.*`, `preferences.generateTests`, `preferences.testingLibrary`, `preferences.testFileConvention`.
- **Writes:** `inProgress.currentTaskIndex`, `inProgress.phase`, `preferences.generateTests` (on first answer).

#### Behavioral example (re-skin task)
```
User: /ui-build
Agent: Task 3: re-skin app/pricing/page.tsx per contracts/pricing-page.md.
       Re-read contract: ✓ approved.
       Pre-emit self-check: 8 PRESERVE ranges identified.
       [emits new page.tsx]
       Post-emit self-check:
         ✓ All PRESERVE ranges intact (lines 1-22, 47-58, 71-89, ...).
         ✓ REPLACE applied to lines 24-45 (JSX shell) and 60-69 (tier map).
       Tests: skipped (preference: off).
       Task 3 complete. Stage and commit?
       Suggested: `style(ui): re-skin app/pricing/page.tsx per contract`
       Run /ui-build again to continue (no more tasks remain — workflow complete).
```

#### Acceptance criteria
- [ ] Halts without an approved contract in re-skin mode (mandatory gate).
- [ ] Performs pre- and post-emit self-checks in re-skin mode.
- [ ] Generates tests only when opted in.
- [ ] Advances `currentTaskIndex` and ends with `phase = "built"`.
- [ ] Surfaces missing tokens as `// TODO` comments + chat warnings.
- [ ] `--task=<N>` with N > total tasks halts with the "task doesn't exist" message.
- [ ] `--task=<N>` pointing to an already-built task halts with the "already built" message unless `--force` is also passed.

---

### 4.8 `/ui-flag`

**Path:** `local-skills/skills/ui-flag/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-flag"
---
```

#### Inputs
- **Required:** A Figma URL.

#### Preconditions
- `docs/ui/repo-ui-guide.md` exists.
- At least one Figma MCP server reachable; agent prefers `figma-dev-mode` for component-instance detection, falls back to `figma-framelink` with a reduced-fidelity warning. If both unreachable, halt with the same message as `/ui-refine` (see §4.4). Diagnose with `/ui-mcp-status`.

#### Behavior

1. Fetch the frame from Figma MCP.
2. Compare against the guide's Inventory and Token Map. Emit a report:
   - **Component deviations:** Figma elements that look like existing components but aren't instances of them.
   - **Token deviations:** color/spacing/typography values not in the token map.
   - **Pattern deviations:** flex divs where the repo has Stack/Inline; hardcoded grid where Grid primitive exists; etc.
3. Severity-label each finding (Critical / Important / Nit) per the always-on `code-review-and-quality` instruction.
4. **Read-only.** Do not write any files. Do not modify session state.

#### Outputs
- Chat output only. No files.

#### Failure modes
- Figma MCP unreachable → halt with config hint.
- Missing guide → recommend `/ui-learn`.

#### Session-state interactions
- None (read-only).

#### Behavioral example
```
User: /ui-flag https://figma.com/file/abc/NewSection
Agent: Findings for NewSection:
       Critical:
         - "Submit" CTA is a raw rectangle. Use Button/Primary instance.
       Important:
         - color #4A90E2 is not in tokens. Closest: tokens.brand.500 (#4F8FE0).
         - 24px gap doesn't match spacing scale (closest: tokens.space.lg = 20px).
       Nit:
         - Heading uses Inter Medium 18; repo uses Inter SemiBold 18 for h3.
       No files modified.
```

#### Acceptance criteria
- [ ] Produces severity-labeled findings.
- [ ] Writes no files.
- [ ] Does not touch session state.

---

### 4.9 `/ui-mcp-status`

**Path:** `local-skills/skills/ui-mcp-status/SKILL.md`

**Frontmatter:**
```yaml
---
mode: agent
description: "Lifecycle command: /ui-mcp-status"
---
```

#### Inputs
- None.

#### Preconditions
- None. Diagnostic command — runs in any state, regardless of `inProgress.phase`.

#### Behavior

1. Emit intro with the standard discoverability hint (Section 5.5).
2. **Probe `figma-dev-mode`** with a low-cost tool call (e.g., a tool-listing or no-arg ping). 3-second timeout.
3. **Probe `figma-framelink`** the same way. 3-second timeout. Probes may run in parallel.
4. **Report** a status block:
   - Active source the agent would use right now (Dev Mode if reachable, else Framelink, else `none`).
   - For each server: reachable / unreachable, the exposed tool names (one line each on reachable), last successful call timestamp from `state.lastMcpProbeAt` if any.
   - PAT presence indicator for Framelink: *"PAT configured (ends …<last 4 chars>)"* or *"PAT missing — Framelink unavailable."* **Never** print the full PAT.
5. **No fix actions.** If a server is down, emit the matching remediation:
   - Dev Mode down → *"Open Figma desktop → Preferences → Enable local MCP Server, then re-run `/ui-mcp-status`."*
   - Framelink down → *"Run `node setup.mjs` to reinstall the `figma-developer-mcp` package or refresh the PAT."*
6. **Read-only.** Does not write files. Updates only `state.lastMcpProbeAt` (top-level ISO timestamp).

#### Outputs
- Chat output only.

#### Failure modes
- Both probes fail → still emit the report (both shown as unreachable) plus remediation. Do not halt the session.
- `mcp.json` missing both managed entries → emit: *"Both managed MCP entries are missing from `mcp.json`. Run `node setup.mjs` to register them."*

#### Session-state interactions
- **Reads:** none (PAT indicator comes from `process.env.FIGMA_API_KEY` presence, not from session state).
- **Writes:** `state.lastMcpProbeAt` (top-level field, ISO timestamp).

#### Behavioral example
```
User: /ui-mcp-status
Agent: Figma MCP status:
         ✓ figma-dev-mode      reachable
             tools: figma_get_frame, figma_get_variables, figma_get_component_instances
         ✗ figma-framelink     unreachable
             PAT configured (ends …a1b2)
         Active source: figma-dev-mode
         Last successful call: 2026-05-22T10:31:00Z

       Framelink is down — typically transient. Re-run after a moment, or
       run `node setup.mjs` to reinstall the npm package.
```

#### Acceptance criteria
- [ ] Reports reachability for both servers within ~6 seconds total (parallel probes acceptable).
- [ ] Never prints the raw PAT — only the last 4 characters.
- [ ] Does not halt the chat session if both servers are unreachable.
- [ ] Updates `state.lastMcpProbeAt` but no other session-state fields.
- [ ] When both managed entries are missing from `mcp.json`, surfaces the `setup.mjs` remediation.

---

## 5. Cross-Skill Interactions

### 5.1 Repo guide injection (always-on)

The `ui-conventions` instruction does **not** read the guide itself — it instructs the agent to read it on demand. The agent uses its file-access tools to load `docs/ui/repo-ui-guide.md` when working on a matching file. The instruction's job is to make this reading habitual, not automatic.

### 5.2 Persona recommends, never executes

The `frontend-craftsman` persona never invokes a slash command. When a trigger matches, it outputs a recommended command string and waits for the dev to type it. This is a deliberate checkpoint — the dev controls cost and intermediate review.

### 5.3 Mid-build correction → Learnings flow

**Scope (v1):** This flow is implemented **only** in the `frontend-craftsman` persona (Section 4.1 item 4). Devs running `/ui-*` slash commands outside that chat mode will get a code fix but no learning-capture prompt. This is a deliberate v1 trade-off — the alternative (duplicating the detection rule into every slash command body) was rejected to keep slash command prompts focused. Future versions may move detection into the always-on `ui-conventions` instruction.

Sequence (in `frontend-craftsman` mode):
1. Agent emits code (typically during `/ui-build`).
2. Dev sends a correction message that contradicts the emitted code.
3. Persona detects per Section 4.1 item 4.
4. Agent fixes the code AND asks the learning-log prompt exactly once.
5. On `y`, agent appends a learning entry to `docs/ui/repo-ui-guide.md`'s Learnings appendix (format in Section 6.1).
6. Agent does not re-ask within the same correction thread.

### 5.4 Workflow phase transitions

```
[none] ──/ui-learn──▶ guide exists
   │
   └─/ui-refine──▶ inProgress.phase = "refined"
         │
         └─/ui-spec──▶ "spec'd"  (re-skin: requires contractApproved)
               │
               └─/ui-plan──▶ "planned"
                     │
                     └─/ui-build──▶ (per task) ──▶ "built"
```

**Out-of-order rule** (applies to the 4 phase-bound commands only — `/ui-refine`, `/ui-spec`, `/ui-plan`, `/ui-build`): if invoked before its prior phase is complete, halt and recommend the correct prior command. `/ui-learn`, `/ui-flag`, and `/ui-mcp-status` are phase-independent and may be invoked anytime.

### 5.5 Discoverability hint (re-skin and --task)

Every `/ui-*` slash command emits the discoverability hint as part of its intro output:

> *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to re-skin existing code instead of generating from scratch. Pass `--task=<N>` to `/ui-build` to jump to a specific task."*

The hint is required on the **first message of each slash command invocation**. Repeating it on every turn within a multi-turn command is not required.

### 5.6 Acceptance criteria (cross-skill)
- [ ] The discoverability hint text appears in the first message of `/ui-learn`, `/ui-refine`, `/ui-spec`, `/ui-plan`, `/ui-build`, `/ui-flag`, and `/ui-mcp-status`.
- [ ] Invoking a phase-bound command out of order halts with a redirect to the correct prior command; `/ui-learn`, `/ui-flag`, and `/ui-mcp-status` run regardless of `inProgress.active`/`phase`.
- [ ] The persona recommends slash commands but never executes them (no agent-side `/ui-*` invocation in chat transcripts).
- [ ] Mid-correction learning-log prompt fires once per disagreement when running in `frontend-craftsman` mode; does not fire in other chat modes.
- [ ] If both MCP servers are unreachable when a phase-bound command needs Figma data, the command halts with the `/ui-mcp-status` remediation pointer (it does not silently degrade).

---

## 6. Artifacts: Templates & Schemas

### 6.1 `docs/ui/repo-ui-guide.md` template

````markdown
# Repo UI Guide

> Generated by `/ui-learn`. Edit freely. Used by Copilot agents to maintain UI consistency. Commit this file.

## Stack
- **Framework:** React 18
- **Language:** TypeScript 5.x (strict)
- **Styling:** Tailwind CSS 3.x
- **Primitives layer:** `components/ui/` (shadcn/ui)
- **Tokens source:** `tokens.ts`
- **Test stack:** vitest + @testing-library/react, co-located as `*.test.tsx`

## Component Inventory

| Component | Path | Purpose | Use when… |
|---|---|---|---|
| Button | `components/ui/Button.tsx` | CTA / form submit | Any clickable action with a visible label |
| Stack | `components/ui/Stack.tsx` | Vertical/horizontal flex layout with gap | Any grouped layout with consistent gap |
| Badge | `components/ui/Badge.tsx` | Small status indicator | Status, tag, count |

## Token Map

| Token path | Tailwind utility | Value |
|---|---|---|
| `tokens.surface.subtle` | `bg-surface-subtle` | `hsl(220 14% 96%)` |
| `tokens.brand.500` | `bg-brand-500` | `hsl(220 90% 50%)` |
| `tokens.space.lg` | `gap-lg` / `p-lg` | `20px` |

## Conventions

- **Naming:** PascalCase component files. One default export per file.
- **Imports:** Use `@/components/ui/*` path alias.
- **Variants:** Use `cva` from `class-variance-authority` for variant systems.
- **Class merging:** Use `cn()` helper from `@/lib/utils`.

## Learnings

> Appended by the agent when the developer corrects a mistake. Each entry is durable knowledge.

### 2026-05-22 — Use `Stack` not raw flex divs
**Context:** Agent generated a settings panel with `<div className="flex flex-col gap-4">`.
**Correction:** Stack primitive exists.
**Rule:** For any vertical/horizontal grouping with consistent gap, use `<Stack gap="md">` from `@/components/ui/Stack`.
````

#### 6.1.1 Greenfield starter banner

When emitted to a greenfield repo, the file begins with:

```markdown
> ⚠ **STARTER GUIDE — please review and edit before committing.** No existing components or tokens were detected; the values below are sensible defaults, not derived from your repo.
```

The agent then populates each section with conventional defaults (Tailwind colors, common shadcn primitives if shadcn was detected, etc.) clearly marked as `(default — please confirm)`.

### 6.2 `docs/ui/.session-state.json` schema

```jsonc
{
  "version": 1,
  "lastUpdated": "2026-05-22T10:34:00Z",
  "lastMcpProbeAt": "2026-05-22T10:31:00Z",  // ISO timestamp | null — written only by /ui-mcp-status
  "preferences": {
    "generateTests": null,                  // boolean | null (null = unasked)
    "testingLibrary": "vitest + @testing-library/react",  // string
    "testFileConvention": "colocated",      // "colocated" | "__tests__"
    "primitivesPath": "components/ui",      // string
    "tokensPath": "tokens.ts",              // string | null
    "deviationPolicy": "flag-and-ask",      // "flag-and-ask" | "auto-substitute" | "as-drawn"
    "starterGuideAccepted": true            // boolean (only meaningful in greenfield path)
  },
  "inProgress": {
    "active": "pricing-page",               // string | null — slug of the active workflow
    "workflows": {                          // map: slug → workflow record
      "pricing-page": {
        "figmaUrl": "https://figma.com/...",
        "frameSlug": "pricing-page",
        "mode": "re-skin",                  // "from-scratch" | "re-skin"
        "target": "app/pricing/page.tsx",   // string | null (null in from-scratch)
        "phase": "planned",                 // "refined" | "spec'd" | "planned" | "built"
        "componentTree": [                  // topologically-aware tree
          { "name": "PricingPage",  "deps": ["PricingTier"] },
          { "name": "PricingTier",  "deps": ["Stack", "Button", "Badge"] },
          { "name": "Badge",        "deps": [] }
        ],
        "deviations": [{ "figmaNodeId": "12:34", "resolution": "substitute-existing" }],
        "contractApproved": true,           // boolean (re-skin only)
        "tasks": [],                        // populated by /ui-plan
        "currentTaskIndex": 2
      }
    }
  }
}
```

**Shorthand:** Throughout this spec, `state.inProgress.<field>` is shorthand for `state.inProgress.workflows[state.inProgress.active].<field>`. The shorthand is a prose convenience only; implementations must use the full path.

**Read/write contract:**
- Every slash command **reads** the file at the start, treating absence as defaults.
- Writes are atomic (write to temp, rename). Update `lastUpdated` on every write.
- Multiple workflows may coexist in `workflows`. Only `inProgress.active` is the default target of phase-bound commands. `/ui-spec`, `/ui-plan`, `/ui-build` accept an optional slug argument to switch the active workflow before executing.
- Crash recovery: at the start of any phase-bound `/ui-*` invocation, if `inProgress.active` is non-null and the user invokes a command for an earlier phase than the active workflow's `phase`, ask: *"Active workflow `<slug>` is at phase `<phase>`. Resume that workflow, switch to another in `workflows`, or discard and start fresh?"*

### 6.3 Preserve/Replace contract format

Path: `docs/ui/contracts/<slug>.md`.

```markdown
# Preserve/Replace Contract — pricing-page

**Target file:** `app/pricing/page.tsx`
**Refinement:** `docs/ui/refinements/pricing-page.md`
**Approved:** 2026-05-22 by developer
**Mode:** re-skin

## PRESERVE (must not be modified)

| Range | Statement | Reason |
|---|---|---|
| L1-L8 | imports | non-UI |
| L10-L18 | `usePricing()` hook call + state | data layer |
| L20-L22 | `const handleSubmit = useCallback(...)` | event handler |
| L47-L58 | `isLoading` branch returning `<Skeleton/>` | unmapped branch |
| L71-L89 | error boundary | not in design |

## REPLACE (full rewrite)

| Range | Original purpose | New purpose |
|---|---|---|
| L24-L45 | JSX shell with hardcoded divs | New layout using Stack + PricingTier |
| L60-L69 | `.map(tier => <div>...)` markup | `.map(tier => <PricingTier {...tier}/>)` |

## UNCERTAIN (must be resolved before approval)

_(empty — all resolved)_

## Self-check enumeration

> Every top-level statement in the target file, assigned to a bucket. Verified by `/ui-spec`.

| # | Statement (line) | Bucket |
|---|---|---|
| 1 | `import` statements (L1-L8) | PRESERVE |
| 2 | `function PricingPage()` declaration (L10) | mixed (REPLACE inside, PRESERVE outside) |
| 3 | `usePricing()` (L11) | PRESERVE |
| 4 | `useState` (L12-L14) | PRESERVE |
| ... | ... | ... |

**Result:** 14/14 statements accounted for. 0 UNCERTAIN. Approved.
```

#### 6.3.1 Approval semantics

The contract is approved by the dev typing `approve` in response to `/ui-spec`'s prompt. The agent records this as `state.inProgress.contractApproved = true` AND writes the file's `**Approved:**` line. `/ui-build` re-reads the file (not session state) before generating.

#### 6.3.2 Self-check enumeration rule

For every top-level statement in the target file (imports, function/const declarations, JSX return blocks), the contract must contain a row in the self-check table with an assigned bucket. If a statement spans multiple buckets (e.g., a function whose body has both preserved and replaced ranges), label it `mixed` with sub-references to the PRESERVE and REPLACE tables.

The agent acknowledges (per Section 8.4) that this enumeration is performed by LLM reasoning over the file's text, not via a deterministic AST tool. The mitigation is the explicit table, which makes any omission visible to the dev.

### 6.4 `docs/ui/refinements/<slug>.md` template

Produced by `/ui-refine`. Small structured markdown — committed to the repo.

````markdown
# Refinement — pricing-page

**Figma URL:** https://figma.com/file/abc/Pricing?node-id=12-34
**Frame slug:** `pricing-page`
**Mode:** re-skin
**Target file:** `app/pricing/page.tsx`   <!-- omit in from-scratch mode -->
**Refined on:** 2026-05-22

## Component Tree

- **PricingPage** (page shell — re-skin target)
  - **PricingTier** (composed — new)
    - Button (reuse: `components/ui/Button.tsx`)
    - Stack  (reuse: `components/ui/Stack.tsx`)
    - Badge  (reuse: `components/ui/Badge.tsx`)

## Reuse Map

| Figma node id | Figma name | Repo component | Notes |
|---|---|---|---|
| 12:45 | "Submit CTA" | `Button` | direct instance |
| 12:67 | "Most Popular badge" | `Badge` | substituted from raw rectangle (deviation #1) |

## Deviations

| # | Figma node | Detected pattern | Resolution |
|---|---|---|---|
| 1 | 12:67 (raw rect) | Looks like our `Badge` | Substituted |
| 2 | 12:89 (font Inter Medium 18) | Repo uses Inter SemiBold 18 for h3 | Flagged, no override |

## Re-skin: Existing JSX Branches  <!-- re-skin mode only -->

| Branch (file:line) | Maps to Figma state | Resolution |
|---|---|---|
| `isLoading → <Skeleton/>` (L47-L58) | none | PRESERVE |
| `error → <ErrorBanner/>` (L71-L89) | Figma shows Toast | PRESERVE (dev override: keep ErrorBanner) |
| `data → tier map` (L60-L69) | tier cards | REPLACE |

## Draft Preserve/Replace Contract  <!-- re-skin mode only; finalized by /ui-spec -->

_(draft buckets carried forward to `/ui-spec` for self-check enumeration and approval)_
````

Sections marked `<!-- re-skin mode only -->` are omitted in from-scratch refinements.

### 6.5 Slug definition

A **slug** uniquely identifies a workflow and is reused across every artifact for that workflow:
- `docs/ui/refinements/<slug>.md`
- `docs/ui/specs/<slug>.md`
- `docs/ui/plans/<slug>.md`
- `docs/ui/contracts/<slug>.md`
- `state.inProgress.workflows[<slug>]`

The terms `<frame-slug>` and `<slug>` are used interchangeably in this spec and refer to the same identifier.

**Default derivation:** kebab-case of the Figma frame's display name (e.g., "Pricing Page" → `pricing-page`). On collision with an existing artifact pointing to a different Figma URL, suffix with `-2`, `-3`, etc. The agent shows the proposed slug and asks the dev to confirm or override before writing any artifact.

---

## 7. Numbered Behavior List (for `/plan` decomposition)

A flat numbered list `/plan` can later decompose into atomic tasks.

1. Extend `skills.config.json` schema to `sources[]` + per-skill `source` field.
2. Implement legacy-config migration in `setup.mjs` (one-time, idempotent, backed up).
3. Implement multi-source resolution in `setup.mjs` (`resolveSourceDir`).
4. Rename existing `.cache/agent-skills/` to `.cache/sources/upstream/` (idempotent).
5. Extend `installInstructions`, `installPrompts`, `installSlashCommands`, `installPersonas` to use per-skill source.
6. Implement local skill file resolution at `<sourceDir>/skills/<name>/SKILL.md`, `<sourceDir>/agents/<name>.md`.
7. Implement name-collision warning + later-wins ordering.
8. Update `printNextSteps` to mention `/ui-*` commands and `frontend-craftsman` persona.
9. Create directory layout under `local-skills/` per Section 2.
10. Author `local-skills/agents/frontend-craftsman.md` per Section 4.1.
11. Author `local-skills/skills/ui-conventions/SKILL.md` per Section 4.2.
12. Author `local-skills/skills/ui-learn/SKILL.md` per Section 4.3.
13. Author `local-skills/skills/ui-refine/SKILL.md` per Section 4.4.
14. Author `local-skills/skills/ui-spec/SKILL.md` per Section 4.5.
15. Author `local-skills/skills/ui-plan/SKILL.md` per Section 4.6.
16. Author `local-skills/skills/ui-build/SKILL.md` per Section 4.7.
17. Author `local-skills/skills/ui-flag/SKILL.md` per Section 4.8.
18. Author `local-skills/skills/ui-mcp-status/SKILL.md` per Section 4.9.
19. Update `skills.config.json` to register the 9 new entries (1 persona + 1 always-on + 7 slash commands) with `source: "local"`.
20. Add the `docs/ui/repo-ui-guide.md` template (Section 6.1) as a reference appendix inside the `ui-learn` skill body, so the agent can produce it byte-for-byte.
21. Add the `docs/ui/.session-state.json` schema and read/write contract (Section 6.2) as a reference appendix inside the persona body, so every `/ui-*` command honors it consistently.
22. Add the Preserve/Replace contract template (Section 6.3) as a reference appendix inside the `ui-spec` skill body.
23. Add `figma-developer-mcp` to `package.json` at a pinned version.
24. Implement Figma MCP registration in `setup.mjs` per Section 3.8 (read/back-up `mcp.json`, register both servers, PAT prompt + `~/.copilot-skills-pack/.env` write, reachability probe, idempotent re-runs, `--uninstall` extension).
25. Author user-facing documentation (README updates, lifecycle diagram, examples gallery, troubleshooting). *(Deliverable name only; content deferred to `/plan`.)*
26. Pilot the suite on 3 repos (greenfield, mid-maturity, mature design system) and record findings.

---

## 8. Boundaries

### 8.1 Always do

- Read `docs/ui/repo-ui-guide.md` before generating any UI.
- Persist preferences in `docs/ui/.session-state.json`.
- Recommend `/ui-learn` if no guide exists.
- Honor the Preserve/Replace contract in re-skin mode.
- Output the `--target` discoverability hint on every `/ui-*` command's first message.
- Severity-label `/ui-flag` findings.

### 8.2 Always ask first

- Before overwriting an existing `docs/ui/repo-ui-guide.md`.
- Before resolving any UNCERTAIN entry in a Preserve/Replace contract.
- Before substituting an existing component for a Figma element when `deviationPolicy === "flag-and-ask"`.
- Before generating tests if the preference is unset.
- Before appending to `.gitignore`.
- Before running `/ui-build` in re-skin mode without an approved contract → halt and require `/ui-spec`.

### 8.3 Never do

- Modify any line in a PRESERVE range during re-skin.
- Refactor, rename, or "modernize" preserved code.
- Generate non-React, non-Tailwind, or non-TypeScript UI code.
- Wire data fetching, routing, or state management for pages.
- Execute slash commands from within a persona.
- Commit files via the agent (the developer commits).
- Skip the contract approval gate in re-skin mode.

### 8.4 Honest constraints

- **`--target` is a documented convention, not a real flag parser.** The agent recognizes `--target=<path>`, `#file:<path>`, or both. Conflicting values halt with a clarifying question.
- **Contract enforcement is LLM-enforced, not deterministic.** The pre/post-emit self-checks in `/ui-build` are agent reasoning over text. The mitigation chain is: explicit contract → mandatory approval → pre-emit re-read → post-emit diff check → always-on `code-review-and-quality` reviewing the resulting diff. None of these are AST-level guarantees.
- **Self-check enumeration uses LLM inspection.** Visibility (the explicit table) is the safeguard, not parser correctness.
- **Learning capture is persona-only in v1.** The mid-correction → Learnings-append flow runs only inside `frontend-craftsman` mode. Slash commands invoked from other chat modes will produce a code fix but no learning prompt. See Section 5.3 for the rationale and the future-version path.

---

## 9. Deliverables

User-facing documentation is a downstream deliverable. The spec lists it; `/plan` writes it.

- [ ] README updates: new "Figma → React" section with installation note (including Dev Mode enable steps and PAT generation), prerequisites table, and lifecycle summary.
- [ ] Lifecycle diagram (idea → ship for UI workflows).
- [ ] Examples gallery: at least one from-scratch and one re-skin worked example.
- [ ] Troubleshooting page for Figma MCP setup: enabling Dev Mode in Figma desktop, generating a PAT, common errors (PAT expired, port 3845 in use, Figma desktop signed out, `figma-developer-mcp` install failures), and how to read each line of `/ui-mcp-status` output.
- [ ] HOW_TO_USE.md additions documenting the `frontend-craftsman` persona and the seven `/ui-*` commands.

---

## 10. Open Questions

These survive into implementation; flag if you encounter blockers.

1. **Exact Figma MCP tool names.** The default is `figma-dev-mode` (primary) + `figma-framelink` (fallback) per §3.8. Both expose similar concepts (frame fetch, variables, component instances) but exact tool names and argument shapes vary by version. Skill bodies must include a discovery step that lists available tools at session start and binds skill behavior to whichever names are present. `/ui-mcp-status` is the source of truth for which tools are exposed in a given run.

2. **Resume prompt UX.** The crash-recovery prompt (Section 6.2) needs UX validation: how annoying is it on every `/ui-*` invocation when there's stale `inProgress` state? Possibly add a "stale after N hours" auto-discard rule. Decide during pilot.

3. **`/ui-flag` integration with always-on `code-review-and-quality`.** The severity labels overlap. Is `/ui-flag` strictly additive (only UI-deviation findings) or does it inherit the full five-axis review? Spec assumes the former. Validate during pilot.

4. **Greenfield "use defaults" detection.** Currently uses a literal string match (`use defaults`). Sensitive to phrasing. Consider a more robust signal during pilot.

5. **PAT env-loading on editor-spawned MCP processes.** `figma-framelink` is launched by the editor's MCP runtime, which may not inherit the user's shell environment (especially on macOS when the editor is launched from Finder). The installer's recommended snippet sources `~/.copilot-skills-pack/.env` from shell rc, but editor-spawned processes may still see an empty `FIGMA_API_KEY`. Decide during pilot whether to write the PAT directly into `mcp.json` (simpler, slight secret-sprawl risk) or invest in a small wrapper script that sources the env file before exec'ing the server.

---

## 11. Acceptance Criteria (Spec-Level)

This spec is considered complete and ready for `/plan` when:

- [ ] All 9 skill files (1 persona + 1 always-on + 7 slash commands) have frontmatter, inputs, preconditions, behavior, outputs, failure modes, session-state interactions, behavioral examples, and acceptance criteria.
- [ ] Prerequisites (Section 1.2) distinguish auto-installable steps from manual ones and acknowledge the paid-seat trade-off.
- [ ] The `setup.mjs` extension contract defines schema, migration, source resolution, file resolution, collision policy, **and the MCP installation contract** (Section 3.8 — both server registrations, PAT handling, reachability probe, uninstall behavior).
- [ ] The repo UI guide template, session-state schema (including `lastMcpProbeAt`), refinement artifact template, and Preserve/Replace contract template are reproducible byte-for-byte from this document.
- [ ] Cross-skill interactions (always-on injection, persona recommendation, mid-correction learning, phase transitions, MCP-unreachable halt behavior) are explicit.
- [ ] Honest constraints (LLM-enforced contracts, MCP tool variability, persona-only learning capture, paid-seat dependency for Dev Mode) are documented.
- [ ] Downstream deliverables (README, examples, MCP troubleshooting) are listed but not specified.
- [ ] Open Questions enumerated with deferral rationale.
