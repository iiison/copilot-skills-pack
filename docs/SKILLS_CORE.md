# Core Skills

The general-purpose skill suite installed by `node setup.mjs`. Sourced
from [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)
and wired into Copilot via this pack.

> For the **Figma → React UI** skill suite see
> [SKILLS_UI.md](./SKILLS_UI.md).
> For install steps see [INSTALL.md](./INSTALL.md).

---

## Table of contents

1. [Mental model](#mental-model)
2. [The three activation methods](#the-three-activation-methods)
3. [The full lifecycle](#the-full-lifecycle)
4. [Slash commands — examples](#slash-commands--examples)
5. [Chat-mode personas — examples](#chat-mode-personas--examples)
6. [Always-on instructions](#always-on-instructions)
7. [On-demand prompts](#on-demand-prompts)
8. [Prompt-writing rules](#prompt-writing-rules)
9. [Providing context](#providing-context)
10. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Mental model

This pack gives Copilot **structured workflows** instead of generic
prompting. Three things are happening behind the scenes:

| What | Where it lives | When it activates | What it does |
|---|---|---|---|
| **Always-on instructions** | `*.instructions.md` | Auto, when a file matches `applyTo` | Adds rules to Copilot's system prompt silently |
| **Prompt files** | `*.prompt.md` | You type `/name` | One-shot workflow injected for that turn |
| **Chat modes** | `*.chatmode.md` | You pick from the mode dropdown | Switches Copilot's whole personality |

You don't need to memorize which skills are which:

- **Editing a file?** Always-on skills are working in the background — talk normally.
- **Need a specific workflow?** Type `/` and pick a command.
- **Want a specialist's perspective?** Switch chat mode.

---

## The three activation methods

### 1. Slash commands

Type `/` at the **start** of the chat input. A picker shows every
command. After picking one, type your actual question on the same line:

```
/spec add a CSV export feature to the dashboards page
```

### 2. Auto-applied instructions (you do nothing)

When you open a file or attach it with `#file:`, any `*.instructions.md`
whose `applyTo` glob matches gets silently merged into Copilot's system
prompt. See the [always-on table below](#always-on-instructions).

To verify a rule is firing: expand "Used N references" under any chat
reply — the matched instruction files appear there.

### 3. Chat modes (personas)

Pick from the mode dropdown at the top of the Copilot Chat panel:

- **`code-reviewer`** — Senior staff engineer review standard
- **`test-engineer`** — Test strategy + coverage analysis
- **`security-auditor`** — Threat modeling + OWASP

Modes apply to **every turn** in that chat session until you switch
back. Use them for whole-conversation specialist work, not one-off
questions.

---

## The full lifecycle

```
💡 Idea   →  📝 Spec    →  📋 Plan    →  🛠 Build   →  ✅ Test    →  🔍 Review   →  ✨ Simplify    →  🚀 Ship
/idea-refine /spec         /plan          /build        /test        /review         /code-simplify     /ship
                                                                     + chat modes
```

You don't need every step. A typo fix uses none. A new feature usually
wants 4–6. Match effort to risk.

---

## Slash commands — examples

### `/idea-refine` — fuzzy idea → focused option

**Use when:** the idea is still soft. "I want a CSV export… or maybe
Excel… or maybe a share link?"

```
/idea-refine

Idea: Let users share a dashboard read-only with a public link.
Constraints: must respect existing org permissions; no sign-up for viewers.
Audience: external stakeholders our customers want to brief.
Success looks like: a "Share" button on a dashboard that produces a URL.
```

You'll get back divergent options, a convergent recommendation, and
open questions. When one option feels right, move to `/spec`.

### `/spec` — write the PRD

```
/spec

Feature: CSV export for dashboards.
Reference our existing dashboards list: #file:app/(app)/dashboards/page.tsx
And the data source: #file:server/dashboards/fetchDashboards.ts
Out of scope: Excel export, scheduled exports, per-row formatting.
```

You'll get back objectives, non-goals, user stories, data model, API
surface, test strategy, and open questions. Save it to
`docs/dashboards/CSV_EXPORT_SPEC.md` (the always-on
`spec-driven-development` skill will keep applying to it later).

**Quality gate** before moving to `/plan` — no slash command needed,
the always-on skills handle it:

```
Review the spec at #file:docs/dashboards/CSV_EXPORT_SPEC.md.
Flag ambiguities, missing acceptance criteria, and unstated
assumptions. Severity-label each: Critical / Important / Nit.
Don't edit yet.
```

### `/plan` — spec → tasks

```
/plan

Spec: #file:docs/dashboards/CSV_EXPORT_SPEC.md

Constraints:
- Each task ≤ ~100 lines of changes
- Order by dependency
- Each task must have acceptance criteria a tester could check
```

Save the output to `docs/dashboards/CSV_EXPORT_PLAN.md`. Refine it if
needed — but **don't** expand scope:

```
Refine #file:docs/dashboards/CSV_EXPORT_PLAN.md.
- Tasks 3 and 4 look like they should merge.
- Task 7 has no acceptance criteria — add measurable ones.
Don't expand scope. Don't add new tasks.
```

### `/build` — implement one task

```
/build task 2 from #file:docs/dashboards/CSV_EXPORT_PLAN.md

Constraints:
- Don't touch files outside this task's scope
- After implementing, list what changed and what you intentionally did NOT touch
- Stop after this task — don't continue into task N+1
```

**Heavy lifting from always-on skills here:**
`incremental-implementation` enforces thin slices,
`security-and-hardening` kicks in for `**/api/**` files,
`git-workflow-and-versioning` enforces atomic commits.

After each task, ask for a commit message — you run the actual `git commit`:

```
Task done, tests pass. Stage the changes and propose a commit message
following git-workflow-and-versioning conventions.
```

### `/test` — explicit test work

The `test-driven-development` skill is **always on** for `.ts`/`.tsx`
files, so this often happens during `/build`. Use the explicit command
when:

- Adding tests to existing untested code
- Writing a regression test for a bug fix

```
/test

Target: #file:lib/exports/toCsv.ts
Approach:
- Unit tests for the pure function
- One integration test for the API route at #file:app/api/exports/route.ts
- Use vitest (project standard)
- Cover the edge cases listed in the spec at #file:docs/.../CSV_EXPORT_SPEC.md
```

**Bug-fix variant** (Prove-It pattern):

```
Bug: [describe symptom]. Repro: [steps].

Following the Prove-It pattern from test-driven-development:
1. Write a failing test that captures the bug
2. Confirm it fails
3. Fix the code
4. Confirm the test passes
5. Don't modify any other tests
```

### `/review` — self-review before PR

```
/review

Diff to review: the staged changes
Reference docs: #file:docs/dashboards/CSV_EXPORT_SPEC.md
Output severity-labeled findings (Critical / Important / Nit / Optional)
```

For deeper, multi-turn review, use the
[`code-reviewer` chat mode](#code-reviewer-deep-multi-turn-review) below.

### `/code-simplify` — reduce complexity

**Use when:** the code works and tests pass, but something feels
overcomplicated.

```
/code-simplify

Target: #file:components/exports/ExportButton.tsx

Goals:
- Reduce nesting / branching
- Inline single-use abstractions
- Preserve behavior exactly — no logic changes

Don't touch tests. After simplifying, tests must still pass unchanged.
```

The skill enforces **Chesterton's Fence** — Copilot will pause on
anything that looks deletable but might exist for a reason.

### `/ship` — pre-launch checklist

```
/ship

Feature: CSV export
Spec: #file:docs/dashboards/CSV_EXPORT_SPEC.md
Diff size: ~N files, ~M lines

Pre-launch checklist needed:
- Feature flag setup (if applicable)
- Rollout plan (canary, percentage, full)
- Monitoring/metrics to watch
- Rollback procedure
```

---

## Chat-mode personas — examples

### `code-reviewer` — deep, multi-turn review

1. Open a fresh chat.
2. Switch the mode dropdown → `code-reviewer`.
3. Prompt:

   ```
   Review my staged changes against #file:docs/dashboards/CSV_EXPORT_SPEC.md.
   Focus axes: correctness, architecture, security, performance.
   ```

4. Iterate: *"explain the architecture concern more"*, *"show me the fix"*.

Switch back to `Ask` / `Agent` when done — `code-reviewer` won't write
features.

### `test-engineer` — coverage analysis

```
[switch mode → test-engineer]

What's the current test surface for #file:lib/exports/.
Identify untested branches, fragile mocks, and missing edge cases.
Propose a Prove-It test for the bug described in #file:docs/.../BUG_42.md.
```

### `security-auditor` — OWASP / threat modeling

```
[switch mode → security-auditor]

Audit these changes for OWASP Top 10 issues:
  #file:app/api/exports/route.ts
  #file:lib/exports/toCsv.ts
Reference: #file:docs/dashboards/CSV_EXPORT_SPEC.md

For each finding, output: severity, exploit scenario, suggested fix.
```

The always-on `security-and-hardening` skill (which auto-applies to
`app/api/**` files) and the `security-auditor` persona stack here.

---

## Always-on instructions

These apply silently when you open or attach a matching file:

| Skill | Applies to | What it enforces |
|---|---|---|
| `incremental-implementation` | every file | Thin vertical slices; ~100-line changes |
| `git-workflow-and-versioning` | every file | Atomic commits; descriptive messages |
| `code-review-and-quality` | every file | Five-axis review on every diff |
| `debugging-and-error-recovery` | every file | Five-step triage before guessing |
| `test-driven-development` | `*.{ts,tsx,js,jsx,mjs,cjs}` | Red-Green-Refactor on code files |
| `frontend-ui-engineering` | `*.{tsx,jsx,css,scss,less}` | Component architecture + a11y |
| `security-and-hardening` | `**/api/**`, `**/auth/**`, `middleware*.*` | OWASP coverage at boundaries |
| `spec-driven-development` | `*.md` | PRD discipline when editing specs |
| `planning-and-task-breakdown` | `*.md` | Decompose into atomic tasks |
| `documentation-and-adrs` | `*.md` | Document the why, not just the what |

To temporarily override: in your prompt say *"ignore the rules from
`code-simplification` for this turn"*. To permanently change: edit
`skills.config.json` (move between `alwaysOn`/`onDemand`, tweak
`applyTo`) and re-run `node setup.mjs`.

---

## On-demand prompts

Attach with `#name` in chat (or just describe the situation — the
matching skill often loads itself):

```
idea-refine                source-driven-development    api-and-interface-design
context-engineering        browser-testing-with-devtools  code-simplification
performance-optimization   ci-cd-and-automation         deprecation-and-migration
shipping-and-launch
```

Example:

```
I need to deprecate the old /v1/exports endpoint. #deprecation-and-migration
Give me a migration plan that doesn't break existing clients.
```

---

## Prompt-writing rules

Five rules that make Copilot dramatically more useful with this pack:

### 1. Pick a verb

| Verb | Means |
|---|---|
| **Review** | Read-only analysis, no edits |
| **Refine** | Tighten what's there, no scope expansion |
| **Implement** | Make changes, follow the plan |
| **Audit** | Check against a specific standard |
| **Walk through** | Explain step by step, no changes |

### 2. State scope and out-of-scope

```
✅ Implement task 3 only. Don't touch task 4 files. Don't reformat
   unrelated code.

❌ Implement task 3.
```

### 3. Provide concrete context

```
✅ Refine #file:PHASE_01_FOUNDATION.md. Validate snippets against
   #file:server/dashboardDetails/fetchDashboardContent.ts.

❌ Refine the foundation phase doc.
```

### 4. Ask for severity labels

```
Output findings severity-labeled: Critical / Important / Nit / Optional.
```

### 5. Force a verification turn

```
Walk through the verification checklist from spec-driven-development
against this spec. Does it pass each item?
```

---

## Providing context

Copilot can't reason about what it can't see:

| Method | When to use | Example |
|---|---|---|
| `#file:path` | Specific file relevant to the task | `#file:app/api/exports/route.ts` |
| `#codebase` | You don't know which files matter | Slow but broad |
| `#selection` | Highlight code in editor first | Quick "explain this" |
| Drag & drop | Multiple files at once | Drag a folder into chat |
| Open the file | Auto-applies matching `applyTo` rules | Just open it before chatting |

**Pro tip:** keep the spec/plan files open in editor tabs while you
chat — Copilot pulls them in automatically.

---

## Troubleshooting & FAQ

| Symptom | Fix |
|---|---|
| `/spec` etc. don't appear in `/` autocomplete | Reload window: Cmd/Ctrl+Shift+P → "Developer: Reload Window" |
| Personas missing from mode dropdown | Reload window. Verify `*.chatmode.md` files exist in `User/prompts/` |
| Confirm a skill is loaded | Expand "Used N references" under any chat reply |
| Copilot ignored an always-on rule | Long context may have crowded it out. Re-state the rule in your prompt |
| Always-on rule conflicts with what you want | Edit its `applyTo` to be narrower, or override in-prompt |
| Update skills | `cd copilot-skills-pack && git pull && node setup.mjs --yes` |
| Clean slate | `node setup.mjs --uninstall && node setup.mjs` |

**Q: Do I need to invoke a slash command every time?**
No. Always-on skills handle the basics silently. Use slash commands for
explicit lifecycle steps.

**Q: Can I stack commands?**
No — only one slash command per turn. Chain them across turns instead:
`/build task 3` → next turn "now `/test` what you just built".

**Q: Slash command vs. chat mode?**
- **Slash command** = one-turn workflow. Quick.
- **Chat mode** = whole-session persona. Use for deep review/audit
  conversations where every reply should be filtered through that lens.

**Q: My team has different conventions.**
Edit the generated `.instructions.md` files directly, or fork this repo
and edit `skills.config.json`. The skills are starting points, not laws.

**Q: How do I know which skill is firing?**
Expand "Used N references" under any chat reply.

---

## Recommended first session (30 minutes)

A no-risk exercise:

1. Pick a small idea you've been mulling — ≤ 1 day of work.
2. `/idea-refine` it.
3. `/spec` it. Save to `docs/sandbox/MY_IDEA_SPEC.md`.
4. Open that spec. Ask: *"Review for ambiguity. Severity-label findings."*
5. `/plan` it. Save output as `docs/sandbox/MY_IDEA_PLAN.md`.
6. `/build` task 1 in a throwaway branch.
7. `/review` your own diff.
8. `git diff` to see what changed; revert anything you dislike.
