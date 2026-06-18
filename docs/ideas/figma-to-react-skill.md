# Figma → React UI Skill Suite

## Problem Statement

**How might we** let a developer point Copilot at a Figma frame (a primitive, a composed section, or a full-page UI) and get back React + TypeScript + Tailwind code that respects the target repo's existing components, tokens, and conventions — and that gets *more* repo-aware with every correction, so the next developer who clones the repo benefits from accumulated UI knowledge?

## Recommended Direction

Add a **UI skill suite** to this same `copilot-skills-pack`, authored locally inside the repo. The suite is composed of:

- **1 persona** (`frontend-craftsman.chatmode.md`) — sets the conversational shape for UI work and recommends the right slash command at the right moment. Cannot auto-execute commands; explicitly defers to user-invoked checkpoints (this is a feature, not a limitation).
- **1 always-on instruction** (`ui-conventions.instructions.md`, `applyTo: **/*.{tsx,ts,css}`) — silently injects `docs/ui/repo-ui-guide.md` into context whenever the dev opens a UI file, in any chat mode.
- **6 slash commands** scoped to the UI lifecycle:
  - `/ui-learn` — one-shot repo scan, produces `docs/ui/repo-ui-guide.md` (committed to the target repo).
  - `/ui-refine` — conversational breakdown of a Figma URL into primitives vs composed vs page; flags deviations from existing components. Accepts optional `--target=<path>` (or attached file) to enter **re-skin mode** — preserves logic, replaces UI only.
  - `/ui-spec` — produces per-component specs (props, variants, states, tokens). In re-skin mode, additionally emits a **Preserve/Replace contract** the dev must approve before generation.
  - `/ui-plan` — file paths, reuse map, new primitives needed, build order.
  - `/ui-build` — generates `.tsx` (and tests if opted in) slice by slice. In re-skin mode, honors the Preserve/Replace contract strictly: never modifies handlers, hooks, props interfaces, or state logic — only JSX structure and styling.
  - `/ui-flag` — standalone "compare this Figma frame to repo, report deviations only."

  Every slash command's intro output reminds the dev: *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to re-skin existing code instead of generating from scratch."*
- **1 session-state file** (`docs/ui/.session-state.json`, gitignored) — persists per-dev preferences (tests yes/no, testing library) and in-progress workflow state across session crashes.
- **1 `setup.mjs` extension** — support a `"source": "local"` entry in `skills.config.json` so locally-authored skills install alongside upstream ones. ~30-line change.

**Stack assumption:** React + TypeScript + Tailwind. Forking the suite for Vue/Svelte/CSS-in-JS is left as a future skill pack.

**Figma MCP:** Officially supports Figma Dev Mode MCP (first-party, exposes Variables and component instances — required for high-quality "flag deviations" behavior). Degrades gracefully if the user has Framelink `figma-developer-mcp` installed instead, with reduced fidelity documented.

**Full-page scope:** UI shell only. No data fetching, no routing, no handler wiring. Pages are generated as layout components that import inner components with stubbed `onClick={() => {}}` placeholders.

## Re-skin Mode: Failure Modes & Contract Discipline

Re-skinning existing working code is the highest-risk workflow in the suite, because the agent has both a working file *and* a design, and is tempted to "improve" things outside the UI layer. The Preserve/Replace contract is the mitigation. **It is mandatory in re-skin mode and cannot be skipped, fast-forwarded, or implied.** `/ui-build` refuses to run in re-skin mode without an approved contract from `/ui-spec`.

Known failure modes the contract is designed to prevent:

| Failure mode | Mitigation enforced by the contract |
|---|---|
| Agent silently rewrites a handler "for clarity" | Handlers are in PRESERVE by default. `/ui-build` fails loudly if generation would touch a preserved range. |
| Agent loses a piece of state because Figma doesn't show that state | UNCERTAIN list forces explicit dev confirmation before generation; defaulting to PRESERVE on ambiguity. |
| Agent collapses a 3-state conditional into 1 because Figma shows only the happy path | `/ui-refine` enumerates all branches in the existing JSX and asks the dev to map each to a Figma state. Unmapped branches stay in PRESERVE. |
| Agent changes the props interface of a component, breaking callers | Props interfaces are in PRESERVE by default. Changes require explicit dev opt-in per component. |
| Agent "modernizes" imports, hooks, or naming during the re-skin | Explicit non-goal (see "Not Doing"). The contract scopes the change to JSX + className + token usage only. |
| Dev approves a contract that's missing something important | `/ui-spec` outputs a self-check section listing every top-level statement in the existing file and which bucket (PRESERVE/REPLACE/UNCERTAIN) it landed in. No silent omissions. |

The contract is a checkpoint, not a formality. If the dev tries to run `/ui-build --target=...` without one, the command halts and points back to `/ui-spec`.

## Key Assumptions to Validate

- [ ] **Figma Dev Mode MCP output is rich enough to drive component decisions.** Validate by running `/ui-inspect` against 3 real Figma files of varying complexity (primitive, composed section, full page). Confirm we get component instances, Variables, and auto-layout semantics — not just node geometry.
- [ ] **Repo introspection in `/ui-learn` produces useful guides across realistic repos.** Pilot on 3 repos: greenfield (no components yet), mid-maturity (shadcn + some custom), mature design system. The guide must be specific enough that a fresh agent session, reading only the guide, generates code matching the existing style.
- [ ] **Developers will actually commit `docs/ui/repo-ui-guide.md` and append to its Learnings section.** Mitigate with frictionless prompts ("log this learning? Y/N") and a guide-end "commit this file" call to action. Measure by checking how often the Learnings section grows across the pilot repos.
- [ ] **The session-state file is robust enough that crash recovery feels seamless and not annoying.** Specifically: the resume prompt must be skippable in one keystroke if the dev wants to start fresh.

## MVP Scope

**In:**
- All 6 slash commands, the persona, the always-on instruction.
- React + TypeScript + Tailwind only.
- Figma Dev Mode MCP as the primary integration; Framelink as documented fallback.
- `docs/ui/repo-ui-guide.md` with Learnings appendix.
- Session state file (`docs/ui/.session-state.json`) for test-preference persistence and crash recovery.
- `setup.mjs` extension for `"source": "local"` skills.
- Tests opt-in per dev, persisted in session state; testing library is whichever the repo guide identifies (default vitest + @testing-library/react).
- Pages = UI shell only, with stubbed event handlers and a clear "data/handlers are your job" comment block at the top of generated page files.
- **Re-skin mode** via `--target=<path>` on `/ui-refine` and `/ui-build`. When active, `/ui-spec` produces a Preserve/Replace contract (with a PRESERVE list, a REPLACE list, and an UNCERTAIN list requiring dev confirmation). `/ui-build` refuses to modify anything in the PRESERVE list and fails loudly if it would have to. Every slash command surfaces the `--target` hint in its intro output so the feature is discoverable.

**Out (explicitly):**
- Storybook / stories generation.
- Pixel-perfect screenshot-diff verification loop.
- Non-React frameworks (Vue, Svelte, Solid).
- Non-Tailwind styling (CSS modules, vanilla-extract, styled-components, MUI, Chakra).
- Auto-wiring of data fetching, routing, state management, event handlers.
- Auto-execution of slash commands from within the persona (platform doesn't support it; explicit checkpoints are a feature).
- Animation, interaction states, responsive breakpoints beyond what Figma auto-layout exposes.
- Multi-repo / monorepo-aware learnings sharing (each repo gets its own guide for v1).

## Not Doing (and Why)

- **Storybook generation** — the dev asked to skip it for v1, and it doubles the surface area of generated code. Can be a `/ui-story` add-on later if demand emerges.
- **Pixel-diff verification loop** — requires headless browser + screenshot infra. High value, high cost, defer to a future `/ui-verify` extension. The "Learnings appendix" pattern is a cheaper way to close the quality gap for now.
- **Other stacks (Vue, Svelte, CSS-in-JS, MUI, Chakra)** — explicit non-goal. The skill structure makes forking for another stack a clean copy-and-modify; trying to generalize v1 makes everything mediocre.
- **Wiring up data, handlers, routing for pages** — Figma can't tell us how the app actually works. Producing confident-but-wrong code in this area is worse than producing nothing. Page output is intentionally a UI shell that defers integration to the dev (or to the existing `/implement` skill).
- **Refactoring or "improving" preserved code during re-skin** — re-skin mode is strictly UI-layer. The skill will not refactor handlers, optimize hooks, rename variables, or change props interfaces of preserved code even if it sees opportunities. Those are separate concerns and belong to `/code-simplify` or a human review pass.
- **Auto-execution of slash commands from the persona** — Copilot's persona/chatmode layer doesn't support runtime loading of other prompts, and *more importantly*, explicit checkpoints are how the dev controls cost and reviews intermediate output. Friction here is a feature.
- **Pushing the skills upstream to `addyosmani/agent-skills` in v1** — author locally first, prove they work across 3 pilot repos, *then* optionally upstream. Avoids external review bottleneck during iteration.
- **Cross-repo Learnings sharing** — each repo owns its UI guide. A central "team UI conventions" sync is a tempting feature but creates governance questions out of scope for v1.

## Open Questions

- **`/ui-learn` heuristics in greenfield repos.** When there are zero existing components, the guide is mostly empty. Do we (a) generate a starter guide with recommended conventions, (b) refuse to generate until at least one primitive exists, or (c) produce a "we found nothing, here are your defaults — edit before committing" template? Lean toward (c) but want to see real greenfield pilots before committing.
- **Deviation-flagging policy.** When `/ui-refine` sees a Figma element that looks like an existing component but isn't an instance of it, should the default be (a) flag and ask, (b) auto-substitute and note, or (c) generate as-drawn and warn? Lean toward (a) for safety, but (b) is faster once trust is built — maybe a persisted preference in session state.
- **Multi-source `setup.mjs` extension shape.** Cleanest API: `skills.config.json` gains a `sources` array, where each entry has `{ id, type: "git" | "local", repo?, ref?, path? }`, and individual skill entries gain an optional `source` field defaulting to `"upstream"`. This is a small but breaking change to the config schema — needs a migration step in `setup.mjs` that auto-upgrades old configs.
- **Where do locally-authored skills live in this repo?** Proposed: `skills/figma-to-component/{learn,refine,spec,plan,build,flag}.md` + `agents/frontend-craftsman.md` + `instructions/ui-conventions.md`. Mirrors the upstream `addyosmani/agent-skills` layout for consistency.

## Next Step

Move to `/spec` to define the precise behavior, frontmatter, and prompt content of each of the 8 skill files (6 slash commands + 1 persona + 1 instruction), plus the `setup.mjs` extension contract and the `docs/ui/repo-ui-guide.md` template.
