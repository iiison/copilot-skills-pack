# /ui-spec

Turn a refinement into per-component specs. In re-skin mode, also
promote the draft Preserve/Replace contract to a final, **dev-approved**
contract that `/ui-build` will read from disk before generating.

## Inputs

- None — reads from `state.inProgress` and the refinement artifact.
- **Optional:** an explicit refinement slug, used when multiple
  workflows coexist in `state.inProgress.workflows`. Without it, the
  active workflow is used.

## Preconditions

- `state.inProgress.phase === "refined"` (i.e. `/ui-refine` ran
  successfully).
- The corresponding `docs/ui/refinements/<slug>.md` exists.

## Behavior

1. **Intro.** Emit the discoverability hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Load** the refinement file + the repo guide.

3. **Per-component spec.** For each component identified by
   `/ui-refine`, produce a spec block containing:

   - **Name** and proposed target file path.
   - **Props interface** with TypeScript types.
   - **Variants** (e.g. `size`, `tone`) with explicit value sets.
   - **States** — default, hover, focus, disabled, loading — **only
     those expressed in Figma**. Do not invent states.
   - **Tokens used** — mapped from Figma Variables to the guide's
     Token Map.
   - **Reuse declaration** — list of existing components it imports.
   - **Accessibility notes** — semantic element (`<button>` vs
     `<div role="button">`), required ARIA, keyboard interactions.

4. **From-scratch mode:** emit the specs and skip steps 5–6.

5. **Re-skin mode (additional steps).**

   a. **Promote** the draft Preserve/Replace contract from
      `/ui-refine` to a final contract using the template in
      Appendix C.

   b. **Self-check enumeration** (Appendix B). List every top-level
      statement in the target file and which bucket
      (`PRESERVE` / `REPLACE` / `UNCERTAIN`) it landed in. Verify **no
      statement is unaccounted for**. If the list is incomplete, halt
      and surface the omission to the developer.

   c. Resolve **all `UNCERTAIN` entries** by asking the developer one
      at a time. Each answer moves the entry to `PRESERVE` or
      `REPLACE`.

   d. After zero `UNCERTAIN` remain, write the final contract to
      `docs/ui/contracts/<slug>.md` (do not stamp the `**Approved:**`
      line yet — step e does that).

   e. Ask:

      > *"Approve this Preserve/Replace contract? `/ui-build` will not
      > run without your approval. (approve / revise)"*

      - On **`approve`**: set
        `state.inProgress.contractApproved = true` and stamp the
        `**Approved:** <date> by developer` line in the file.
      - On **`revise`**: loop back to step 5a.
      - After **3** failed approval rounds, halt and ask whether to
        abort the workflow.

6. **Close.**

   - Write per-component specs to `docs/ui/specs/<slug>.md`
     (committed).
   - Update `state.inProgress.phase = "spec'd"`.
   - Emit: *"Specs ready. Run `/ui-plan` next."*

## Outputs

- `docs/ui/specs/<slug>.md` — committed.
- `docs/ui/contracts/<slug>.md` — committed (re-skin mode only).

## Failure modes

- **No `inProgress` refinement** → halt; recommend `/ui-refine`.
- **Self-check finds an unaccounted statement** → halt, surface the
  omission, ask the developer to assign it.
- **Developer refuses to approve contract after 3 revisions** → halt;
  ask whether to abort the workflow. **Do not** force approval.

## Session-state interactions

- **Reads:** all of `inProgress.workflows[<slug>]`,
  `preferences.tokensPath`.
- **Writes:** `inProgress.workflows[<slug>].contractApproved`,
  `inProgress.workflows[<slug>].phase`.

## Behavioral example

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

## Honest constraints

- The self-check enumeration is **LLM reasoning over the file's text**,
  not a deterministic AST tool. The mitigation is the **explicit table**:
  emit it verbatim every time, even if it seems redundant, so any
  omission is visible to the developer.
- Never paraphrase a `PRESERVE` range away. Quote the original snippet
  in the contract so `/ui-build`'s post-emit self-check has a textual
  anchor.

---

## Appendix A — Slug definition

Same slug used across the workflow:
`docs/ui/refinements/<slug>.md`, `docs/ui/specs/<slug>.md`,
`docs/ui/plans/<slug>.md`, `docs/ui/contracts/<slug>.md`,
`state.inProgress.workflows[<slug>]`.

---

## Appendix B — Self-check enumeration rule

For every top-level statement in the target file (imports,
function/const declarations, JSX return blocks), the contract must
contain a row in the self-check table with an assigned bucket. If a
statement spans multiple buckets (e.g. a function whose body has both
preserved and replaced ranges), label it `mixed` with sub-references
to the `PRESERVE` and `REPLACE` tables.

The enumeration is performed by LLM reasoning over the file's text,
**not** via a deterministic AST tool (spec §8.4). The mitigation is the
explicit table.

---

## Appendix C — Preserve/Replace contract template

Path: `docs/ui/contracts/<slug>.md`. Emit byte-for-byte.

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

### Approval semantics

The contract is approved by the developer typing `approve` in response
to `/ui-spec`'s prompt. Record this as
`state.inProgress.contractApproved = true` **and** stamp the
`**Approved:**` line in the file. `/ui-build` re-reads the **file** (not
session state) before generating.
