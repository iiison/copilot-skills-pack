# /ui-flag

Fetch a Figma frame, compare it against the repo guide, and emit a
**severity-labeled** list of deviations. **Read-only** — writes no
files, touches no session state.

## Inputs

- **Required:** A Figma URL.

## Preconditions

- `docs/ui/repo-ui-guide.md` exists. If missing, recommend `/ui-learn`
  and halt.
- At least one Figma MCP server reachable. Prefer `figma-dev-mode`
  (component-instance detection); fall back to `figma-framelink` with
  a reduced-fidelity warning. If **both** are unreachable, halt with
  the same message as `/ui-refine`:

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

2. **Fetch** the frame from Figma MCP.

3. **Compare** against the guide's Inventory and Token Map. Emit a
   report with three sections:

   - **Component deviations** — Figma elements that look like existing
     components but aren't instances of them.
   - **Token deviations** — color, spacing, typography values not in
     the Token Map. Suggest the closest existing token where
     reasonable.
   - **Pattern deviations** — flex divs where the repo has
     `Stack` / `Inline`; hardcoded grid where a `Grid` primitive
     exists; etc.

4. **Severity-label** each finding using the same scale as the always-on
   `code-review-and-quality` instruction:

   - **Critical** — would ship a visibly wrong / broken experience or
     violate the Token Map (e.g. hardcoded brand color).
   - **Important** — measurable inconsistency (off-scale spacing,
     non-token color close to an existing one).
   - **Nit** — minor stylistic deviation (font weight 500 vs 600).

   `/ui-flag` adds **UI-specific** findings; the always-on
   `code-review-and-quality` instruction handles non-UI severity.
   This command is **additive**, not a replacement.

5. **Read-only.** **Do not** write any files. **Do not** modify session
   state. End with the line *"No files modified."* so the developer
   can verify with `git status`.

## Outputs

- Chat output only. **No files.**

## Failure modes

- **Figma MCP unreachable** → halt with the precondition message;
  point at `/ui-mcp-status` and `node setup.mjs`.
- **Missing guide** → recommend `/ui-learn`.

## Session-state interactions

- **None.** This is the only `/ui-*` command that touches neither the
  state file nor any artifact.

## Behavioral example

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

## Honest constraints

- Token closeness is heuristic — Euclidean distance in HSL space is a
  reasonable default for colors, nearest-neighbor on the spacing scale
  for sizes. Do not promise pixel-perfect mapping; **suggest**, do not
  prescribe.
- Without Dev Mode (Framelink only), component-instance detection
  degrades. Add a single up-front note: *"Framelink fallback active —
  component-instance findings may be missed."*
