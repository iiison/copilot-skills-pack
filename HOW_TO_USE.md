# How to Use copilot-skills-pack

A practical guide to going from a fuzzy idea to shipped code using this pack with GitHub Copilot in VS Code.

> **Prerequisite:** You've run `node setup.mjs` and reloaded VS Code.
> Verify by typing `/` in Copilot Chat — you should see commands like `/spec`, `/plan`, `/build`.

---

## Table of contents

1. [Mental model](#mental-model)
2. [The three activation methods](#the-three-activation-methods)
3. [The full lifecycle: idea → ship](#the-full-lifecycle-idea--ship)
4. [Phase 0 — Refine an idea](#phase-0--refine-an-idea)
5. [Phase 1 — Write a spec](#phase-1--write-a-spec)
6. [Phase 2 — Plan tasks](#phase-2--plan-tasks)
7. [Phase 3 — Build incrementally](#phase-3--build-incrementally)
8. [Phase 4 — Test](#phase-4--test)
9. [Phase 5 — Review (self-review before PR)](#phase-5--review-self-review-before-pr)
10. [Phase 6 — Simplify (optional)](#phase-6--simplify-optional)
11. [Phase 7 — Security audit (when applicable)](#phase-7--security-audit-when-applicable)
12. [Phase 8 — Ship](#phase-8--ship)
13. [Cross-cutting: how to write good prompts](#cross-cutting-how-to-write-good-prompts)
14. [Cross-cutting: providing context](#cross-cutting-providing-context)
15. [Troubleshooting](#troubleshooting)
16. [FAQ](#faq)

---

## Mental model

This pack gives Copilot **structured workflows** instead of generic prompting. Three things are happening behind the scenes:

| What | Where it lives | When it activates | What it does |
|---|---|---|---|
| **Always-on instructions** | `*.instructions.md` | Auto, when a file matches `applyTo` | Adds rules to Copilot's system prompt silently |
| **Prompt files** | `*.prompt.md` | You type `/name` | One-shot workflow injected for that turn |
| **Chat modes** | `*.chatmode.md` | You pick from mode dropdown | Switches Copilot's whole personality |

You don't need to memorize which skills are which. The pattern is:

- **Editing a file?** Always-on skills are working in the background — you just talk normally.
- **Need a specific workflow?** Type `/` and pick a command.
- **Want a specialist's perspective?** Switch chat mode.

---

## The three activation methods

### Method 1: `/` — slash commands

Type `/` at the **start** of the chat input. A picker shows all 17 commands installed by this pack.

```
/spec        /plan        /build       /test        /review
/ship        /code-simplify
/idea-refine /context-engineering /source-driven-development
/api-and-interface-design /browser-testing-with-devtools
/code-simplification /performance-optimization
/ci-cd-and-automation /deprecation-and-migration /shipping-and-launch
```

After picking one, type your actual question on the same line:

```
/spec add a CSV export feature to the dashboards page
```

### Method 2: Auto-applied instructions (you do nothing)

When you open a file or attach it with `#file:`, any `*.instructions.md` whose `applyTo` glob matches gets silently merged into Copilot's system prompt.

For this pack, the always-on rules are:

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

To verify they're loading: expand "Used N references" under any chat response. The instruction files appear there.

### Method 3: Chat modes (personas)

The mode dropdown is at the **top of the Copilot Chat panel**, next to the model picker. Default modes are `Ask`, `Edit`, `Agent`. After install, you'll also see:

- **`code-reviewer`** — Senior staff engineer review standard
- **`test-engineer`** — Test strategy + coverage analysis
- **`security-auditor`** — Threat modeling + OWASP

Pick one → its instructions apply to **every turn** in that chat session until you switch back. Use these for whole-conversation specialist work, not one-off questions.

---

## The full lifecycle: idea → ship

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  💡 Idea     →  📝 Spec    →  📋 Plan    →  🛠 Build            │
│  /idea-refine  /spec         /plan          /build               │
│                                                                  │
│       →  ✅ Test    →  🔍 Review  →  ✨ Simplify  →  🚀 Ship    │
│          /test         /review        /code-simplify  /ship      │
│                        + chat modes                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

You don't have to use every step. A typo fix needs none. A new feature usually wants 4–6 of them. Match effort to risk.

---

## Phase 0 — Refine an idea

**Use when:** the idea is still fuzzy. "I want a CSV export… or maybe Excel… or maybe a share link?"

**Skip when:** you already know what you want.

**Command:** `/idea-refine`

**Prompt template:**
```
/idea-refine

Idea: [one or two sentences]
Constraints I know about: [if any]
Audience: [who uses this]
Success looks like: [if you have a hunch]
```

**Real example:**
```
/idea-refine

Idea: Let users share a dashboard read-only with a public link.
Constraints: must respect existing org permissions; no sign-up for viewers.
Audience: external stakeholders our customers want to brief.
Success looks like: a "Share" button on a dashboard that produces a URL.
```

**What you get back:**
- Divergent options (3–5 different framings)
- Convergent recommendation (which one to pursue and why)
- Open questions to resolve before writing a spec

**Next step:** when one option feels right, move to `/spec`.

---

## Phase 1 — Write a spec

**Use when:** you know roughly what you want and need to commit it to writing before any code.

**Command:** `/spec`

**Prompt template:**
```
/spec

Feature: [name]
What it does: [one paragraph]
Out of scope: [things people might assume but you're saying no to]
Constraints: [tech, deadlines, dependencies]
Where it lives in the codebase: [paths if known]
```

**Pro tip:** attach related code so the spec uses real names:

```
/spec

Feature: CSV export for dashboards.
Reference our existing dashboards list: #file:app/(app)/dashboards/page.tsx
And the data source: #file:server/dashboards/fetchDashboards.ts
```

**What you get back:** a markdown spec with:
- Objectives & non-goals
- User stories / commands
- Data model & API surface
- Code style notes pulled from your repo
- Test strategy
- Open questions

**Save it as a file** in your repo (e.g. `docs/dashboards/CSV_EXPORT_SPEC.md`). The always-on `spec-driven-development` skill will keep applying to it whenever you open it later.

**Quality gate:** before moving to `/plan`, run this:
```
Review the spec at #file:docs/dashboards/CSV_EXPORT_SPEC.md.
Flag ambiguities, missing acceptance criteria, and unstated assumptions.
Severity-label each: Critical / Important / Nit. Don't edit yet.
```

That review is powered by the always-on `code-review-and-quality` and `spec-driven-development` skills — no command needed.

---

## Phase 2 — Plan tasks

**Use when:** the spec is solid and you need to break it into shippable units.

**Command:** `/plan`

**Prompt template:**
```
/plan

Spec: #file:docs/dashboards/CSV_EXPORT_SPEC.md

Constraints:
- Each task ≤ ~100 lines of changes
- Order by dependency
- Each task must have acceptance criteria a tester could check
```

**What you get back:** a numbered task list, each one:
- Has a clear goal
- Lists files to create / edit
- Has acceptance criteria
- Notes dependencies on prior tasks

**Save it** alongside the spec (e.g. `docs/dashboards/CSV_EXPORT_PLAN.md`).

**Refine it** if needed:

```
Refine #file:docs/dashboards/CSV_EXPORT_PLAN.md.

- Tasks 3 and 4 look like they should merge.
- Task 7 has no acceptance criteria — add measurable ones.
- Add explicit "out of scope" notes where you noticed leakage.

Don't expand scope. Don't add new tasks.
```

---

## Phase 3 — Build incrementally

**Use when:** spec + plan exist and it's time to write code.

**Command:** `/build`

**Prompt template:**
```
/build task N from #file:docs/dashboards/CSV_EXPORT_PLAN.md

Constraints:
- Don't touch files outside this task's scope
- After implementing, list what changed and what you intentionally did NOT touch
- Stop after this task — don't continue into task N+1
```

**The always-on skills are doing heavy lifting here:**

- `incremental-implementation` enforces thin slices and scope discipline
- `frontend-ui-engineering` kicks in for `.tsx`/`.css` files
- `security-and-hardening` kicks in for `**/api/**` files
- `git-workflow-and-versioning` enforces atomic commits

**Pro tip:** ask Copilot to commit after each task:

```
The task is done and tests pass. Stage the changes and propose a
commit message following the conventions in git-workflow-and-versioning.
```

You then run the actual `git commit`.

**Repeat** for each task. Don't batch. One task → test → commit → next task.

---

## Phase 4 — Test

The `test-driven-development` skill is **always on** for `.ts`/`.tsx` files, so this often happens during `/build`. Use the explicit command when:

- You're adding tests to existing untested code
- You hit a bug and want a regression test first

**Command:** `/test`

**Prompt template:**
```
/test

Target: #file:lib/exports/toCsv.ts
Approach:
- Unit tests for the pure function
- One integration test for the API route at #file:app/api/exports/route.ts
- Use vitest (project standard)
- Cover the edge cases listed in the spec at #file:docs/.../CSV_EXPORT_SPEC.md
```

**For bug fixes specifically:**

```
There's a bug: [describe symptom]. Repro: [steps].

Following the Prove-It pattern from test-driven-development:
1. Write a failing test that captures the bug
2. Confirm it fails
3. Fix the code
4. Confirm the test passes
5. Don't modify any other tests
```

---

## Phase 5 — Review (self-review before PR)

**Use when:** code is written, tests pass, you're about to open a PR.

**Two ways to do it:**

### Option A — `/review` (one-shot)

```
/review

Diff to review: the staged changes
Reference docs: #file:docs/dashboards/CSV_EXPORT_SPEC.md
Output severity-labeled findings (Critical / Important / Nit / Optional)
```

### Option B — `code-reviewer` chat mode (multi-turn)

For a deeper review where you want to discuss findings:

1. Open a fresh chat
2. Switch mode dropdown → `code-reviewer`
3. Prompt:
   ```
   Review my staged changes against #file:docs/dashboards/CSV_EXPORT_SPEC.md.
   Focus axes: correctness, architecture, security, performance.
   ```
4. Iterate: "explain the architecture concern more", "show me the fix", etc.

**When the review's done, switch the mode back to `Ask` or `Agent`** before continuing — `code-reviewer` won't write features.

---

## Phase 6 — Simplify (optional)

**Use when:** the code works, the review is clean, but something feels overcomplicated.

**Command:** `/code-simplify`

**Prompt template:**
```
/code-simplify

Target: #file:components/exports/ExportButton.tsx

Goals:
- Reduce nesting / branching
- Inline single-use abstractions
- Preserve behavior exactly — no logic changes

Don't touch tests. After simplifying, tests must still pass unchanged.
```

The `code-simplification` skill enforces **Chesterton's Fence** — Copilot will pause on anything that looks deletable but might exist for a reason.

---

## Phase 7 — Security audit (when applicable)

**Use when:** the change touches user input, auth, data storage, or external integrations.

**Skip when:** purely internal refactor with no new boundaries.

**Mode:** switch dropdown → `security-auditor`

**Prompt:**
```
Audit the changes I'm about to merge for OWASP Top 10 issues.

Reference the new code: #file:app/api/exports/route.ts
                       #file:lib/exports/toCsv.ts
Reference the spec:    #file:docs/dashboards/CSV_EXPORT_SPEC.md

For each finding, output: severity, exploit scenario, suggested fix.
```

The always-on `security-and-hardening` skill (which auto-applies to any `app/api/**` file) and the `security-auditor` persona stack here.

**Switch back to `Ask` mode** when done.

---

## Phase 8 — Ship

**Use when:** code is reviewed, tested, and ready to deploy.

**Command:** `/ship`

**Prompt template:**
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

You'll get a checklist and rollout plan. Treat it as a guide, not gospel — adapt to your team's process.

---

## Cross-cutting: how to write good prompts

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

Without this, Copilot will "helpfully" expand scope:

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

Aligns with `code-review-and-quality`:

```
Output findings severity-labeled: Critical / Important / Nit / Optional.
```

### 5. Force a verification turn

Skills end with verification checklists. Make Copilot use them:

```
Walk through the verification checklist from spec-driven-development
against this spec. Does it pass each item?
```

---

## Cross-cutting: providing context

Copilot can't reason about what it can't see. Three ways to add context:

| Method | When to use | Example |
|---|---|---|
| `#file:path` | Specific file relevant to the task | `#file:app/api/exports/route.ts` |
| `#codebase` | You don't know which files matter | Slow but broad |
| `#selection` | Highlight code in editor first | Quick "explain this" |
| Drag & drop | Multiple files at once | Drag a folder into chat |
| Open the file | Auto-applies matching `applyTo` rules | Just open it before chatting |

**Pro tip:** keeping the spec/plan files open in editor tabs while you chat helps Copilot pull them in automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/spec` etc. don't appear in `/` autocomplete | Reload window: Cmd/Ctrl+Shift+P → "Developer: Reload Window" |
| Personas missing from mode dropdown | Reload window. Verify `*.chatmode.md` files exist in user prompts dir |
| Want to confirm a skill is loaded | Expand "Used N references" under any chat response |
| Copilot ignored an always-on rule | The rule may have been crowded out by long context. Re-state the rule explicitly in your prompt |
| Always-on skill conflicts with what you want | Edit its `applyTo` to be narrower, or override in-prompt: "ignore code-simplification for this turn — I want verbose code" |
| Want to update skills | `cd copilot-skills-pack && git pull && node setup.mjs --yes` |
| Want a clean slate | `node setup.mjs --uninstall` then re-run `node setup.mjs` |

---

## FAQ

**Q: Do I need to invoke a slash command every time?**
No. Always-on skills handle the basics silently. Slash commands are for explicit lifecycle steps (`/spec`, `/plan`, `/build`, etc.) or when you want to force a specific skill that isn't always on.

**Q: Can I stack commands?**
No — only one slash command per turn. But you can chain naturally:
> `/build` task 3 — then in the next turn ask: "now `/test` what you just built"

**Q: When should I use a chat mode vs a slash command?**
- **Slash command** = one-turn workflow. Quick.
- **Chat mode** = whole-session persona. Use for deep review/audit conversations where you want every reply filtered through that lens.

**Q: How do I disable an always-on skill temporarily?**
Easiest: in your prompt say "ignore the rules from `code-simplification` for this turn." For permanent: edit the skill's `applyTo` in the `.instructions.md` file (or move it from `alwaysOn` to `onDemand` in `skills.config.json` and re-run setup).

**Q: My team has different conventions than these skills suggest.**
Edit the generated `.instructions.md` files directly, or fork this repo and edit `skills.config.json`. The skills are starting points, not laws.

**Q: Can I add my own custom skills?**
Yes. Drop a `*.instructions.md` or `*.prompt.md` file into `~/Library/Application Support/Code/User/prompts/` (path varies by OS). The installer won't touch files that lack the `<!-- managed-by: copilot-skills-pack -->` marker.

**Q: Will this work in Cursor / VS Code Insiders?**
Yes. Re-run `node setup.mjs --target=cursor` or `--target=insiders`.

**Q: How do I know which skill is firing?**
Expand "Used N references" under any chat response. The `.instructions.md` files Copilot pulled in are listed there.

---

## Recommended first session

A 30-minute exercise to learn the flow without risk:

1. Pick a small idea you've been mulling — anything ≤ 1 day of work.
2. `/idea-refine` it. Don't edit anything yet.
3. `/spec` it. Save the output to `docs/sandbox/MY_IDEA_SPEC.md`.
4. Open that spec. Ask: "Review for ambiguity. Severity-label findings." (always-on skills handle this)
5. `/plan` it. Save output as `docs/sandbox/MY_IDEA_PLAN.md`.
6. `/build` task 1 in a throwaway branch.
7. `/review` your own diff.
8. `git diff` to see what Copilot actually changed; revert if you don't like it.

By the end, you'll have a feel for which steps you actually need vs. skip for your style of work.
