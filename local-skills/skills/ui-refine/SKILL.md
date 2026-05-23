# /ui-refine

Fetch a Figma frame, propose a component breakdown, and (in re-skin
mode) draft a Preserve/Replace contract that `/ui-spec` will finalize.

## Inputs

- **Required:** A Figma URL (frame, section, or page).
- **Optional:** `--target=<workspace-relative-path>` or a `#file:<path>`
  attachment to enter **re-skin mode**. If both are present, they must
  reference the same path; if they disagree, halt and ask which to use.

## Preconditions

- `docs/ui/repo-ui-guide.md` exists. If missing, halt and recommend
  `/ui-learn`.
- `state.preferences.starterGuideAccepted !== false`. If `false`
  (greenfield path where the developer has not edited the starter
  guide or typed `use defaults`), halt with:

  > *"The starter guide hasn't been accepted yet. Edit
  > `docs/ui/repo-ui-guide.md` or type `use defaults` and re-run
  > `/ui-learn` to confirm before refining."*

- At least one Figma MCP server is reachable. Call `figma-dev-mode`
  **first** (richest fidelity — Variables and component instances).
  On tool error or timeout, transparently fall back to
  `figma-framelink`. If **both** fail, halt:

  > *"No Figma MCP server reachable. Open Figma desktop with Dev Mode
  > enabled (Preferences → Enable local MCP Server), or verify
  > `FIGMA_API_KEY` is set for the Framelink fallback. Run
  > `node setup.mjs` to (re)install. Diagnose with `/ui-mcp-status`."*

## Behavior

1. **Intro.** Emit the discoverability hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Fetch phase.** Call the Figma MCP tools in the order below and
   record the results in memory before drafting any narrative. **Do
   not skip these calls** — the measurement sections of Appendix B
   are populated *from these responses*, not from the Figma viewer or
   inferred Tailwind scale steps.

   | # | Tool | Required? | What to extract |
   |---|---|---|---|
   | 1 | `get_design_context(nodeId)` | **required** | Subtree: node names + types, **bounding boxes (px)**, `layoutMode`, `paddingLeft/Top/Right/Bottom`, `itemSpacing`, `primaryAxisAlignItems`, `counterAxisAlignItems`, **fills (hex)**, text style refs, **corner radii**, **stroke weights**, **effects (shadows / blurs)**, component instance refs. |
   | 2 | `get_variable_defs(nodeId)` | **required** | Every Figma Variable in scope resolved to its raw value (color hex, spacing px, typography object). Use this to populate the Tokens table. |
   | 3 | `get_screenshot(nodeId)` | recommended | PNG of the frame, kept only for visual sanity. **Never measure pixels off the screenshot** — always use values from tool #1. |
   | 4 | `get_metadata(nodeId)` | only if needed | Use when `get_design_context` truncates a large subtree; this returns IDs + bounding boxes only. |

   **Halt rule:** if `get_design_context` was not called (or returned
   no data), halt and recommend `/ui-mcp-status`. Do not proceed with
   inferred values.

   **Tool name discovery:** the tool prefix varies by MCP server build
   (e.g. `mcp_figma-dev-mode_get_design_context`). If the literal names
   above are not present, run a `tools/list` lookup and match by
   suffix; record the active names in session state under
   `inProgress.workflows[<slug>].mcpToolMap`.

   If only Framelink is available, emit once:

   > *"Framelink fallback active — Component instance and Variables
   > data are not available. Open Figma desktop with Dev Mode enabled
   > for full fidelity."*

3. **Detection phase.**

   - `mode = "from-scratch"` if no target.
   - `mode = "re-skin"` if `--target` or `#file:` is present.
   - In re-skin mode, also read the target file.

4. **Breakdown phase (conversational).**

   - Propose a **component tree**: which Figma elements are
     primitives (reuse), composed (compose primitives), and the
     page-level shell (if applicable).
   - For each candidate primitive that **looks like** an existing
     component in the guide's Inventory but is **not** a Component
     instance in Figma, **flag the deviation** per
     `state.preferences.deviationPolicy`:

     | Policy             | Behavior                                                                                                                                    |
     |--------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
     | `flag-and-ask` (default) | Show side-by-side, ask *"Substitute existing `<Component>` for this Figma rectangle? (y / n / keep-asking)"*. `keep-asking` keeps this policy. |
     | `auto-substitute`  | Substitute and note in output.                                                                                                              |
     | `as-drawn`         | Generate as-drawn. Warn **once** at the end.                                                                                                |

   - Iterate with the developer until the breakdown is approved.
   - One-time policy answers (e.g. *"substitute this once but stop
     asking for the rest of this frame"*) are **not persisted** —
     write to session state only when the policy itself changes.

5. **Re-skin branch (if `--target` is set).**

   - Read the target file. Parse top-level statements via inspection
     of the text — **acknowledged: not AST-deterministic** (see
     spec §8.4).
   - **Enumerate every conditional branch** in the existing JSX. For
     each branch, ask the developer which Figma state it maps to.
     Unmapped branches stay in **PRESERVE**.
   - Build a **draft** of the Preserve/Replace contract (template in
     Appendix B). Do **not** finalize — finalization happens in
     `/ui-spec`.
   - Set `state.inProgress.mode = "re-skin"` and
     `state.inProgress.target = <path>`.

6. **Close.**

   - Save the approved breakdown to
     `docs/ui/refinements/<frame-slug>.md` per Appendix B (committed;
     small markdown file).
   - Update `state.inProgress` for the active workflow:
     `{ figmaUrl, frameSlug, phase: "refined", componentTree,
        deviations, mode, target? }`.
   - Emit: *"Refinement complete. Run `/ui-spec` to produce component
     specs."*

## Outputs

- `docs/ui/refinements/<frame-slug>.md` (committed).
- Updates to `docs/ui/.session-state.json`.

## Failure modes

- **Figma MCP unreachable / URL invalid** → halt; suggest
  `/ui-mcp-status` and `node setup.mjs`.
- **Dev Mode MCP unavailable, Framelink fallback active** → continue
  with the warning above. **Do not** attempt manual screenshot
  interpretation as a substitute.
- **Both MCP servers unreachable** → halt per the precondition message.
- **Target file (re-skin mode) does not exist** → halt and ask whether
  the developer meant a different path.
- **Conflicting `--target` and `#file:`** → halt and ask which to use.

## Session-state interactions

- **Reads:** `preferences.deviationPolicy`, `preferences.primitivesPath`.
- **Writes:** `preferences.deviationPolicy` (on first answer that
  changes the policy), `inProgress.workflows[<slug>].*`.

## Behavioral example (re-skin)

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

## Honest constraints

- The Figma MCP tool surface varies by upstream version. The Behavior
  section above pins the canonical Dev Mode tool names; on a server
  build that uses different names, fall back to a `tools/list` lookup
  and match by suffix (`*get_design_context`, `*get_variable_defs`,
  etc.). If `get_design_context` is unavailable on the active server,
  degrade to layout-only output and warn the developer — do **not**
  silently substitute inferred values.
- Branch enumeration in re-skin mode is **LLM reasoning over the file's
  text**, not an AST parse. Surface the enumerated list explicitly so
  the developer can spot omissions; do not summarize away the table.
- The Appendix B measurement tables are mandatory output, not optional.
  Empty cells must be filled with `?` (and a note explaining why the
  tool response lacked that field) so `/ui-spec` can detect gaps
  before code is generated.
---

## Appendix A — Slug definition

A **slug** uniquely identifies a workflow and is reused across every
artifact for that workflow:

- `docs/ui/refinements/<slug>.md`
- `docs/ui/specs/<slug>.md`
- `docs/ui/plans/<slug>.md`
- `docs/ui/contracts/<slug>.md`
- `state.inProgress.workflows[<slug>]`

**Default derivation:** kebab-case of the Figma frame's display name
(e.g. "Pricing Page" → `pricing-page`). On collision with an existing
artifact pointing to a different Figma URL, suffix with `-2`, `-3`, …
**Always** show the proposed slug and ask the developer to confirm or
override before writing any artifact.

---

## Appendix B — `docs/ui/refinements/<slug>.md` template

Emit byte-for-byte. Omit sections marked `<!-- re-skin mode only -->`
in from-scratch refinements.

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

## Frame Geometry

Measured values from `get_design_context`. Use `?` if a property
wasn't returned, with a brief note in the row.

| Property | Value |
|---|---|
| Width × Height | 1440 × 56 px |
| Background | `#FFFFFF` (token: `bg/bg-default`) |
| Border | 1px solid `#E5E7EB` (token: `border/border-subtle`) |
| Corner radius | 0 |

## Auto-layout (per container)

One row per Figma node that has `layoutMode != NONE`. Values are raw
from the MCP response.

| Node (id) | layoutMode | padding L/T/R/B | itemSpacing | primaryAxisAlign | counterAxisAlign |
|---|---|---|---|---|---|
| DashboardHeader (12:01) | HORIZONTAL | 24 / 12 / 24 / 12 | 12 | SPACE_BETWEEN | CENTER |
| Breadcrumbs (12:05)     | HORIZONTAL | 0 / 0 / 0 / 0     | 8  | MIN           | CENTER |

## Typography (per text node)

| Node (id) | Font | Size / LH | Weight | Letter-spacing | Token (if any) |
|---|---|---|---|---|---|
| Title (12:10) | Inter | 14 / 20 | 600 | -0.005em | `text/heading/sm` |

## Tokens used (resolved from `get_variable_defs`)

| Token | Raw value |
|---|---|
| `bg/bg-default` | `#FFFFFF` |
| `border/border-subtle` | `#E5E7EB` |
| `spacing/3` | 12 |
| `text/heading/sm` | Inter 14/20 600 |

## Effects

| Node (id) | Type | Value |
|---|---|---|
| FavoriteButton (12:20) | shadow (hover) | `0 1 2 rgba(0,0,0,0.08)` |
| Container (12:01) | corner radius | 0 |

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
