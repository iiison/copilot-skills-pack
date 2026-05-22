# /ui-plan

Turn the per-component specs into a **topologically ordered** task list
that `/ui-build` executes one task at a time. Each task is a single
component (or the page shell) with a file path, reuse imports, new
primitives, build order, acceptance criteria, and — in re-skin mode —
a contract reference.

## Inputs

- None — reads from session state and prior artifacts.

## Preconditions

- `state.inProgress.phase === "spec'd"`.

## Behavior

1. **Intro.** Emit the discoverability hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Load** the spec file + the repo guide + (re-skin) the contract.

3. **Produce a numbered task list.** Each task is a single component
   (or the page shell) with:

   - **File path** — resolved against the guide's primitives path,
     the spec's proposed path, and the target file for re-skin.
   - **Reuse imports** — list of existing components / tokens
     imported.
   - **New primitives needed** — listed **separately** so the
     developer can decide whether to merge them into the existing
     primitive layer before the build proceeds.
   - **Build order** — topologically sorted: **leaves before
     composites**, **page shell last**.
   - **Acceptance criteria** — testable.
   - **Re-skin annotation** (if applicable) — references the contract
     section governing this task.

4. **Emit** the ordered list to chat. **Save** to
   `docs/ui/plans/<slug>.md`.

5. **Update state:**

   - `state.inProgress.phase = "planned"`
   - `state.inProgress.tasks = [<task records>]`
   - `state.inProgress.currentTaskIndex = 0`

6. Emit:

   > *"Plan ready. Run `/ui-build` to start (begins at task 1)."*

## Outputs

- `docs/ui/plans/<slug>.md` — committed.

## Failure modes

- **No spec'd refinement in progress** → halt and recommend `/ui-spec`.
- **Build order has a cycle** (composites referencing each other) →
  halt, surface the cycle (e.g. "A depends on B depends on A"), ask the
  developer to break it. **Do not** silently pick an order.

## Session-state interactions

- **Reads:** `inProgress.workflows[<slug>].*`.
- **Writes:** `inProgress.workflows[<slug>].phase`,
  `inProgress.workflows[<slug>].tasks`,
  `inProgress.workflows[<slug>].currentTaskIndex`.

## Behavioral example

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

## Honest constraints

- Cycle detection is **LLM reasoning over the spec text**, not a graph
  algorithm against an AST. If the dependency table is large enough to
  miss a cycle, prefer **over-flagging** to silent ordering — print
  the suspected cycle and ask.
- Mark tasks for components that already exist as "no work needed" and
  skip them; do not regenerate existing files.

---

## Appendix — `docs/ui/plans/<slug>.md` shape

````markdown
# Plan — pricing-page

**Mode:** re-skin
**Slug:** `pricing-page`
**Generated:** 2026-05-22

## Tasks

### Task 1 — `components/ui/Badge.tsx`
- **Status:** existing, no work needed
- **Reuse:** —
- **New primitives:** —
- **A/C:** referenced by Task 2.

### Task 2 — `components/pricing/PricingTier.tsx`
- **Status:** new
- **Reuse:** `Stack`, `Button`, `Badge`
- **New primitives:** —
- **A/C:**
  - Matches `PricingTier` spec in `docs/ui/specs/pricing-page.md`.
  - Props type matches verbatim.
  - No token violations (only entries from the guide's Token Map).

### Task 3 — `app/pricing/page.tsx` (re-skin)
- **Status:** re-skin per `docs/ui/contracts/pricing-page.md`
- **Reuse:** `PricingTier`, `Stack`
- **New primitives:** —
- **A/C:**
  - `PRESERVE` list untouched (verified by post-emit self-check).
  - `REPLACE` list fully replaced.
  - Zero `UNCERTAIN` entries remain.
````
