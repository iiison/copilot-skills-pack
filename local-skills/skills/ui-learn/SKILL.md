# /ui-learn

Scan the repo, ask 4–6 targeted questions, and produce
`docs/ui/repo-ui-guide.md` — the single source of truth that every other
`/ui-*` command reads before generating UI. Also creates a gitignored
`docs/ui/.session-state.json` for cross-command state.

## Inputs

- None required.
- Optional: a comma-separated list of additional doc paths the developer
  wants you to consider (e.g.
  `/ui-learn docs/design-system.md, https://internal.notion/ui`).

## Preconditions

- Workspace is a code repo (presence of `package.json` or `.git/`).

## Behavior

1. **Intro.** Emit:

   > *"Scanning your repo to capture UI conventions. I'll ask a few
   > targeted questions, then produce `docs/ui/repo-ui-guide.md`."*

   Then emit the discoverability hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Scan phase (read-only).** Read:

   - `package.json` — detect React version, TypeScript, Tailwind,
     shadcn/ui, testing libraries.
   - `tailwind.config.*` and any CSS file with `@tailwind` /
     `@theme` directives — extract custom colors, spacing, fonts.
   - `src/components/**`, `app/components/**`, `components/**`, `ui/**`
     (whichever exist) — list components with their file paths and
     exported names.
   - Files matching `tokens.*`, `theme.*`, `design-tokens.*` — capture
     token definitions.
   - `src/**/*.test.{ts,tsx}`, `**/__tests__/**` — detect the test
     file convention (co-located vs `__tests__/` folder).
   - Any markdown in `docs/ui/`, `docs/design/`, `STYLE.md`,
     `CONTRIBUTING.md` — flag for human review; do not auto-include.

3. **Question phase.** Ask **4–6 targeted questions** based on scan
   results. Skip any question whose answer is unambiguous from the
   scan. Examples:

   - *"I see shadcn/ui in `package.json`. Is `components/ui/*` your
     primitive layer?"*
   - *"Found `tokens.ts` with 32 color variables. Treat as the
     authoritative token map?"*
   - *"No `Stack`/`Inline` layout primitives detected. Want me to flag
     designs that need them?"*
   - *"Tests are colocated as `*.test.tsx`. Confirm this convention for
     generated tests?"*

4. **Greenfield branch.** If the scan finds **zero** existing components
   AND no Tailwind config AND no tokens:

   - Emit the **starter template** (Appendix B below) with the banner
     from Appendix A.
   - Set `state.preferences.starterGuideAccepted = false`.
   - **Do not proceed** to `/ui-refine` until either the file is edited
     (mtime change) or the developer explicitly types `use defaults`.

5. **Write phase.**

   - Write `docs/ui/repo-ui-guide.md` per the template in Appendix B.
   - Create `docs/ui/.session-state.json` per the persona's session-state
     schema if absent, with default values.
   - **Ask the developer** before appending `docs/ui/.session-state.json`
     to `.gitignore`. Show the diff and confirm.

6. **Closing prompt.**

   > *"Done. Review the guide and commit it
   > (`git add docs/ui/repo-ui-guide.md && git commit -m 'docs: capture UI conventions'`).
   > Future sessions and teammates will read this before generating any UI."*

## Outputs

- `docs/ui/repo-ui-guide.md` (committed).
- `docs/ui/.session-state.json` (gitignored).
- `.gitignore` updated (with confirmation).

## Failure modes

- **Workspace root not detectable** → halt:
  *"Couldn't locate a repo root. Open the workspace folder and retry."*
- **`docs/ui/repo-ui-guide.md` already exists** → ask:
  *"A guide exists. Refresh from scan (overwrite Inventory / Token
  sections, preserve Learnings) or cancel?"* Default: **cancel**.
- **Multiple plausible primitive locations** (e.g. both `components/`
  and `ui/`) → ask the developer to choose.

## Session-state interactions

- **Writes:** `preferences.testingLibrary`, `preferences.testFileConvention`,
  `preferences.primitivesPath`, `preferences.tokensPath`,
  `preferences.starterGuideAccepted`.
- **Reads:** none on first run; on re-run, reads existing preferences to
  skip already-answered questions.

## Behavioral example

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

## Honest constraints

- Scan-phase question count depends on signal strength. The cap is
  **6**; skip questions whose answers are unambiguous from the scan.
- `/ui-learn` does not analyze JSX bodies — only file paths, exports,
  and config. Deeper component analysis happens in `/ui-flag` and
  `/ui-spec`.

---

## Appendix A — Greenfield starter banner

When emitted in a greenfield repo, the guide file **begins** with this
exact banner line:

```markdown
> ⚠ **STARTER GUIDE — please review and edit before committing.** No existing components or tokens were detected; the values below are sensible defaults, not derived from your repo.
```

Mark every section that uses defaults (no signal from scan) with
`(default — please confirm)` so the developer can spot which entries
need editing.

---

## Appendix B — `docs/ui/repo-ui-guide.md` template

Emit byte-for-byte. Fill `<placeholders>` from the scan + questions.
In greenfield mode, prepend the Appendix A banner.

````markdown
# Repo UI Guide

> Generated by `/ui-learn`. Edit freely. Used by Copilot agents to maintain UI consistency. Commit this file.

## Stack
- **Framework:** React <version>
- **Language:** TypeScript <version> (strict)
- **Styling:** Tailwind CSS <version>
- **Primitives layer:** `<primitivesPath>` (<source — shadcn/ui / custom / none>)
- **Tokens source:** `<tokensPath or "none detected">`
- **Test stack:** <testingLibrary>, <testFileConvention>

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
