# UI Skills — Figma → React

A skill suite that turns Figma frames into production-grade React/Tailwind
components. Lives in [`local-skills/`](../local-skills/) and is wired in
via the `local` source in `skills.config.json`.

> For install steps (including Figma MCP setup) see
> [INSTALL.md](./INSTALL.md). For the general lifecycle skills see
> [SKILLS_CORE.md](./SKILLS_CORE.md).

---

## Table of contents

1. [What's in the suite](#whats-in-the-suite)
2. [Concepts you need to know](#concepts-you-need-to-know)
3. [Setup — new repo](#setup--new-repo)
4. [Setup — existing repo](#setup--existing-repo)
5. [The `frontend-craftsman` persona](#the-frontend-craftsman-persona)
6. [Slash commands — examples](#slash-commands--examples)
7. [Re-skin mode in depth](#re-skin-mode-in-depth)
8. [End-to-end walkthrough — from scratch](#end-to-end-walkthrough--from-scratch)
9. [End-to-end walkthrough — re-skin](#end-to-end-walkthrough--re-skin)
10. [Troubleshooting](#troubleshooting)

---

## What's in the suite

| Kind | Name | Purpose |
|---|---|---|
| Always-on instructions | `ui-conventions` | Repo UI guide is the source of truth; reuse over re-creation |
| Slash command | `/ui-learn` | Discover the repo's UI vocabulary; write the guide |
| Slash command | `/ui-mcp-status` | Debug the Figma MCP servers |
| Slash command | `/ui-refine` | Fetch a Figma frame; propose a component breakdown |
| Slash command | `/ui-spec` | Per-component specs + (re-skin) finalize the contract |
| Slash command | `/ui-plan` | Topologically ordered task list |
| Slash command | `/ui-build` | Generate one task at a time with self-checks |
| Slash command | `/ui-flag` | Read-only deviation report (no files written) |
| Chat-mode persona | `frontend-craftsman` | Whole-session UI specialist |

All written for **React + Tailwind**. They refuse Vue/Svelte with a
documented message — see `frontend-craftsman.md` for the verbatim text.

---

## Concepts you need to know

### The repo UI guide — `docs/ui/repo-ui-guide.md`

A single markdown file describing your repo's design system: token map,
component inventory, accepted patterns, and gotchas. **Every** UI skill
reads it. If it's missing, `/ui-learn` writes a starter.

### Slug

A kebab-case identifier (e.g. `pricing-page`) shared by every artifact
for one workflow:

```
docs/ui/refinements/<slug>.md   ← /ui-refine
docs/ui/specs/<slug>.md         ← /ui-spec
docs/ui/plans/<slug>.md         ← /ui-plan
docs/ui/contracts/<slug>.md     ← /ui-spec (re-skin only)
```

### Session state — `docs/ui/.session-state.json`

A small JSON file that tracks where you are in the workflow
(`phase`, `currentTaskIndex`, `contractApproved`, …). The agent reads
and writes it; you generally shouldn't.

### From-scratch vs. re-skin

| Mode | When | How triggered |
|---|---|---|
| **From-scratch** | The component doesn't exist yet | `/ui-refine <figma-url>` (no target) |
| **Re-skin** | You're re-styling an existing file but keeping its logic | `/ui-refine <figma-url> --target=<path>` (or attach with `#file:`) |

Re-skin is **guarded** by a Preserve/Replace contract — see
[Re-skin mode in depth](#re-skin-mode-in-depth).

---

## Setup — new repo

You're starting a project (or starting UI work in a project that doesn't
have a design system yet).

```
1.  Run the installer (one-time, machine-wide):
       cd copilot-skills-pack
       node setup.mjs          # answer "yes" to the Figma MCP step

2.  In your new repo, open Copilot Chat and run:
       /ui-learn

3.  Because the repo has no existing components / tokens / Tailwind
    config, /ui-learn emits a "starter guide" with this banner:
       "⚠ STARTER GUIDE — please review and edit before committing.
        Defaults shown below."

4.  Edit docs/ui/repo-ui-guide.md to reflect your choices:
      - Tokens (colors, spacing scale, type scale)
      - Primitives location (e.g. components/ui/)
      - Accepted patterns (Stack/Inline/Grid? Server Components?)
    OR type "use defaults" back to the agent if you're happy as-is.

5.  Verify Figma MCP servers are reachable:
       /ui-mcp-status

6.  Commit the guide. You're ready to /ui-refine.
```

Why the manual review? The starter guide is **inferred defaults**.
Committing without review locks in arbitrary choices that every future
component will follow.

---

## Setup — existing repo

You're adding UI skills to a repo that already has components, tokens,
and conventions.

```
1.  Run the installer (one-time, machine-wide):
       cd copilot-skills-pack
       node setup.mjs

2.  In the existing repo, run:
       /ui-learn

3.  /ui-learn scans the codebase:
      - Tailwind config (tailwind.config.{js,ts})
      - Components directory (heuristics: components/, ui/, lib/ui/, src/components/)
      - Existing CSS variables / token files
      - Sample component files for accepted patterns
    Then it writes docs/ui/repo-ui-guide.md as a synthesis.

4.  Review the guide. The Inventory and Token Map sections will look
    familiar — they reflect what the agent found in your code.
    Correct anything wrong (it's reading, not divine).

5.  Verify Figma MCP servers:
       /ui-mcp-status

6.  Commit the guide. You're ready to /ui-refine.
```

`/ui-learn` is **idempotent and re-runnable**. Run it again any time:
- After a major dependency change (Tailwind v4, new design system)
- When the agent looks confused about a pattern
- When the `frontend-craftsman` persona offers to log a mid-build
  correction back to the guide

---

## The `frontend-craftsman` persona

A chat-mode persona for **whole-session UI work**. Switch the mode
dropdown to `frontend-craftsman` and every turn in that chat is filtered
through it.

### When to use it

- You're spending the next hour on UI work, not a one-off question.
- You want the agent to **recommend** which slash command comes next.
- You want the **mid-correction learning** behavior — when you correct
  something the agent built, it asks: *"Should I log this as a learning
  to `docs/ui/repo-ui-guide.md`? (y/n)"*.

### When **not** to use it

- One-off "what does this skill do?" → leave mode on `Ask`.
- Non-UI work — the persona will refuse anything outside React/Tailwind
  UI tasks.

### Behavioral example

```
[switch mode → frontend-craftsman]

User: I want to build the new pricing page from Figma.

Agent: First, do you have docs/ui/repo-ui-guide.md? If not, run
       /ui-learn to capture this repo's UI vocabulary — every other
       /ui-* command reads it.

       Recommended next steps:
       | Command       | Purpose                                    |
       |---------------|--------------------------------------------|
       | /ui-learn     | Generate or update the repo UI guide       |
       | /ui-refine    | Break down a Figma frame                    |
       | /ui-spec      | Produce per-component specs                 |
       | /ui-plan      | Topologically ordered task list             |
       | /ui-build     | Generate one task at a time                 |

       Tip: pass --target=<path> (or attach a file with #file:) to any
       /ui-refine or /ui-build invocation to re-skin existing code
       instead of generating from scratch.

User: I have the guide. Let's start with /ui-refine.
```

Later, mid-build correction:

```
Agent: [generates components/pricing/PricingTier.tsx]

User: No, our Cards use rounded-lg not rounded-2xl.

Agent: Got it — adjusted to rounded-lg.
       Should I log this as a learning to docs/ui/repo-ui-guide.md? (y/n)

User: y

Agent: Added to the Token / Convention section. The change applies to
       future builds in this repo.
```

---

## Slash commands — examples

### `/ui-learn` — write or refresh the repo UI guide

```
/ui-learn
```

No arguments. The skill scans the workspace and produces (or updates)
`docs/ui/repo-ui-guide.md`. Greenfield repos get a starter template
with a `⚠ STARTER GUIDE` banner — you must edit or accept defaults
before `/ui-refine` will run.

### `/ui-mcp-status` — debug the Figma MCP servers

```
/ui-mcp-status
```

Parallel-probes both Figma MCP servers (3 s budget each):

```
✓ figma-dev-mode    reachable (127.0.0.1:3845)
⚠ figma-framelink   reachable, PAT configured (last 4: ····hMq2)
```

If a server is down, the output explains how to start it. The PAT is
**always** redacted — only the last 4 characters print. If your PAT is
shorter than 4 characters the output says
*"PAT configured (too short to redact safely — re-generate)"*.

### `/ui-refine` — Figma URL → component breakdown

**From-scratch:**

```
/ui-refine https://figma.com/file/abc/Pricing?node-id=12-34
```

**Re-skin (option A — flag):**

```
/ui-refine https://figma.com/file/abc/Pricing?node-id=12-34 --target=app/pricing/page.tsx
```

**Re-skin (option B — attachment):**

```
/ui-refine https://figma.com/file/abc/Pricing?node-id=12-34 #file:app/pricing/page.tsx
```

Writes `docs/ui/refinements/<slug>.md`. In re-skin mode also drafts a
Preserve/Replace contract that `/ui-spec` will finalize.

### `/ui-spec` — per-component specs (+ contract approval in re-skin)

```
/ui-spec
```

No arguments — reads from session state. Emits a spec block per
component (Name, Props with TS types, Variants, States, Tokens
mapped, Reuse, A11y). In re-skin mode it also runs the self-check
enumeration, resolves any `UNCERTAIN` entries, and asks:

```
Approve this Preserve/Replace contract? /ui-build will not run without
your approval. (approve / revise)
```

Type **`approve`** to proceed. Up to 3 revisions; after that the skill
asks whether to abort.

### `/ui-plan` — ordered task list

```
/ui-plan
```

Writes `docs/ui/plans/<slug>.md`. Tasks are topologically sorted —
**leaves before composites, page shell last**. Existing components are
marked "no work needed" and skipped.

### `/ui-build` — generate one task at a time

```
/ui-build              # generate next task (uses currentTaskIndex)
/ui-build --task=3     # jump to task 3
/ui-build --task=3 --force   # rebuild a task even if it appears already built
```

On the first invocation of a workflow, asks once:

```
Generate tests for components in this build? (y/n)
```

Per task, the skill:

1. Re-reads the spec, plan task, and (re-skin) contract from disk.
2. **Pre-emit self-check** (re-skin only): identifies all `PRESERVE`
   byte ranges.
3. Generates the file.
4. **Post-emit self-check** (re-skin only): diffs every changed line
   against the contract. If a `PRESERVE` range was modified, halts
   without writing:

   ```
   Contract violation detected. Generation would modify a PRESERVE
   range: app/pricing/page.tsx:47-58 — original: <snippet>
   This is forbidden. Aborting this task. Re-run /ui-spec to revise
   the contract or amend the design.
   ```

5. Generates a colocated `*.test.tsx` if tests were opted in.
6. Suggests a commit message and stops — **you** run `git commit`.

### `/ui-flag` — read-only deviation report

```
/ui-flag https://figma.com/file/abc/NewSection
```

Compares the frame against the guide; emits severity-labeled findings
(Critical / Important / Nit). **Writes zero files**, touches **zero**
session state. Ends with the line *"No files modified."* so you can
verify with `git status`.

---

## Re-skin mode in depth

### What is re-skin?

You have an existing file (`app/pricing/page.tsx`) with working logic:
data fetching, error boundaries, event handlers, state machines. The
**design** is being refreshed, but the **logic must stay intact**.
Re-skin lets you re-style the JSX without rewriting the data layer.

### How it's enforced — the Preserve/Replace contract

Before `/ui-build` is allowed to touch the file, you and the agent
agree, **in writing**, on which ranges of the original file are
`PRESERVE` (must not change) and which are `REPLACE` (full rewrite).
That agreement lives at `docs/ui/contracts/<slug>.md` and contains an
`**Approved:** <date>` line stamped only after you type `approve`.

```
┌──────────────────────────────────────────────────────────────────┐
│ /ui-refine  → drafts contract (PRESERVE / REPLACE / UNCERTAIN)   │
│ /ui-spec    → resolves UNCERTAINs; you type `approve`            │
│ /ui-plan    → orders tasks; page-shell task references contract  │
│ /ui-build   → re-reads contract from disk; runs pre/post checks  │
│               If post-emit diff touches a PRESERVE range → halt  │
└──────────────────────────────────────────────────────────────────┘
```

### Why it matters

LLMs are confident pattern-matchers. Without an explicit contract,
"re-skin" gradually drifts into "rewrite" — the data hook gets
"improved", the error boundary disappears. The contract makes the
boundary auditable.

### Recommended workflow

```
1.  Start the re-skin:
       /ui-refine <figma-url> --target=app/pricing/page.tsx

2.  Walk through every existing JSX branch the agent enumerates. Assign
    each to PRESERVE, REPLACE, or UNCERTAIN. Unmapped branches default
    to PRESERVE (safe).

3.  /ui-spec — resolve any remaining UNCERTAIN entries one at a time.
    Read the contract before approving. If anything's wrong, type
    `revise`.

4.  /ui-plan — confirm the page-shell task references the contract.

5.  /ui-build — watch the post-emit self-check on the shell task. If
    you see "Contract violation detected", do NOT bypass — the contract
    is right, the generation was wrong.

6.  Commit. Diff against the previous commit to visually confirm
    PRESERVE ranges are byte-identical.
```

### Honest constraints

The pre/post self-checks are **LLM reasoning over file text**, not a
deterministic AST diff. The mitigation is the **explicit verification
table** the skill emits every time. Read it; don't skim.

---

## End-to-end walkthrough — from scratch

A new pricing page in a fresh repo.

```
1.  /ui-learn
    → Writes a starter docs/ui/repo-ui-guide.md.
    → You edit it (tokens, primitives path) and commit.

2.  /ui-refine https://figma.com/file/abc/Pricing?node-id=12-34
    → Agent breaks the frame into PricingPage → PricingTier → Button.
    → Flags one deviation: Figma rectangle that should be the existing
      Badge. You confirm substitute.
    → Writes docs/ui/refinements/pricing-page.md.

3.  /ui-spec
    → Per-component spec for PricingTier:
      Props: { tier, price, ctaLabel, isPopular? }
      Variants: tone = ['default','featured']
      Tokens: bg → tokens.surface.subtle, …
      A11y: <article role="region" aria-label={tier}>
    → Writes docs/ui/specs/pricing-page.md.
    → No contract step (from-scratch mode).

4.  /ui-plan
    → Tasks:
        1. components/pricing/PricingTier.tsx — new
        2. app/pricing/page.tsx — new
    → Writes docs/ui/plans/pricing-page.md.

5.  /ui-build
    → "Generate tests? (y/n)" → y
    → Generates PricingTier.tsx + PricingTier.test.tsx.
    → "Task 1 complete. Suggested commit:
       feat(ui): add PricingTier"
    → You: git add -A && git commit -m "feat(ui): add PricingTier"

6.  /ui-build  (continues at task 2)
    → Generates app/pricing/page.tsx + page.test.tsx.
    → Workflow complete.
```

---

## End-to-end walkthrough — re-skin

The pricing page exists with working data-fetching, error boundaries,
and a loading skeleton. Design has been refreshed.

```
1.  /ui-refine https://figma.com/file/abc/Pricing?node-id=12-34 \
              --target=app/pricing/page.tsx
    → Agent reads the existing file + Figma.
    → Enumerates 3 JSX branches:
        isLoading → <Skeleton/>     no Figma equivalent  → PRESERVE
        error     → <ErrorBanner/>  Figma has Toast      → UNCERTAIN
        data      → tier map        REPLACE
    → You: "Keep ErrorBanner. Don't switch to Toast."
    → Branch resolved as PRESERVE.
    → Writes refinement + draft contract.

2.  /ui-spec
    → Self-check enumeration (14 statements):
        1. imports                          PRESERVE
        2. function PricingPage()           mixed
        3. usePricing()                     PRESERVE
        4. useState                         PRESERVE
        ...
       0 UNCERTAIN. Asks: "Approve? (approve / revise)"
    → You: approve
    → Stamps **Approved:** 2026-05-22 in docs/ui/contracts/pricing-page.md.

3.  /ui-plan
    → Task 1: PricingTier.tsx (new)
    → Task 2: app/pricing/page.tsx (re-skin per contract)

4.  /ui-build  (task 1 — PricingTier)
    → Standard generation. No contract gate (new file).

5.  /ui-build  (task 2 — page.tsx)
    → Re-reads docs/ui/contracts/pricing-page.md from disk.
    → Verifies **Approved:** line present.
    → Pre-emit self-check: 8 PRESERVE ranges identified.
    → Generates the new file.
    → Post-emit self-check:
        ✓ All PRESERVE ranges intact (lines 1-22, 47-58, 71-89, ...).
        ✓ REPLACE applied to lines 24-45 and 60-69.
    → Task complete. Suggested commit:
       style(ui): re-skin app/pricing/page.tsx per contract

6.  Diff against previous HEAD:
       git diff HEAD~1 -- app/pricing/page.tsx
    Confirm PRESERVE ranges are byte-identical to the previous version.
    Commit.
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/ui-*` commands missing from `/` picker | Re-run `node setup.mjs --yes` and reload the window. |
| *"docs/ui/repo-ui-guide.md not found"* | Run `/ui-learn`. |
| *"The starter guide hasn't been accepted yet"* | Edit `docs/ui/repo-ui-guide.md` (or type `use defaults` back to `/ui-learn`) and re-run `/ui-refine`. |
| *"No Figma MCP server reachable"* | Run `/ui-mcp-status`. Start Figma desktop with Dev Mode enabled, or set `FIGMA_API_KEY`. Re-run `node setup.mjs` if needed. |
| Framelink fallback warning every time | Open Figma desktop → Preferences → Enable local MCP Server. |
| *"Contract violation detected"* in `/ui-build` | The contract is right, the generation was wrong. Do **not** bypass. Re-run `/ui-spec` to revise the contract if the design genuinely changed. |
| Workflow stuck in `inProgress` after a mistake | Edit `docs/ui/.session-state.json` or delete the relevant workflow entry; the next `/ui-*` command will re-bootstrap. |
| PAT prompt appears every install | Set `FIGMA_API_KEY` in your shell, **or** verify `~/.copilot-skills-pack/.env` exists with mode `0600`. |
| Want to re-prompt for a new PAT | `rm ~/.copilot-skills-pack/.env && node setup.mjs --force` |

See also: [INSTALL.md](./INSTALL.md#troubleshooting-install-issues) for
installer-side issues.
