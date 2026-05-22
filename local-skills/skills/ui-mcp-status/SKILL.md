# /ui-mcp-status

Diagnostic. Probes both managed Figma MCP servers, reports reachability
and tool surface, and points at remediation. **Read-only** apart from a
single `state.lastMcpProbeAt` write.

## Inputs

- None.

## Preconditions

- None. This command runs in any state, regardless of
  `inProgress.phase`. Use it whenever a phase-bound command halts with
  "MCP unreachable."

## Behavior

1. **Intro.** Emit the discoverability hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Probe `figma-dev-mode`** with a low-cost call (the MCP
   `tools/list` request, or a no-arg ping if the server exposes one).
   **3-second timeout.** Capture the exposed tool names on success.

3. **Probe `figma-framelink`** the same way, also with a **3-second
   timeout**. The two probes may run in parallel.

4. **Report.** Emit a status block containing:

   - **Active source** the agent would use right now:
     - `figma-dev-mode` if reachable.
     - `figma-framelink` if Dev Mode is unreachable but Framelink is.
     - `none` if both are unreachable.
   - **Per server:**
     - reachable / unreachable
     - on reachable: exposed tool names, one per line
     - last successful call timestamp from `state.lastMcpProbeAt` if
       previously recorded
   - **PAT presence indicator** for Framelink:
     - if `FIGMA_API_KEY` is set in the environment:
       *"PAT configured (ends `…<last 4 chars>`)"*
     - else: *"PAT missing — Framelink unavailable."*

   **Never print the full PAT.** Only the **last 4 characters**, never
   the first characters and never the length. If for any reason the
   token is shorter than 4 characters, print *"PAT configured (too
   short to redact safely — re-generate)"* instead.

5. **Remediation (no automated fixes).** If a server is down, emit the
   matching one-line remediation:

   - **Dev Mode down:**
     *"Open Figma desktop → Preferences → Enable local MCP Server, then
     re-run `/ui-mcp-status`."*
   - **Framelink down:**
     *"Run `node setup.mjs` to reinstall the `figma-developer-mcp`
     package or refresh the PAT."*

6. **Edge case: both managed entries missing.** If `mcp.json` exists but
   neither `figma-dev-mode` nor `figma-framelink` is registered, emit:

   > *"Both managed MCP entries are missing from `mcp.json`. Run
   > `node setup.mjs` to register them."*

7. **State write.** Update **only** `state.lastMcpProbeAt` (top-level,
   ISO timestamp). Do not touch any other field. If the file is missing,
   create it with defaults and just the `lastMcpProbeAt` write.

## Outputs

- Chat output only. No files written or modified beyond
  `state.lastMcpProbeAt`.

## Failure modes

- **Both probes fail** → still emit the full report (both shown as
  unreachable) plus remediation. **Do not halt the chat session** —
  the developer needs the diagnostic.
- **`mcp.json` unreadable or missing** → emit:
  *"`mcp.json` not found or unreadable. Run `node setup.mjs` to install
  the Figma MCP servers."* No state write in this case.

## Session-state interactions

- **Reads:** none. The PAT indicator comes from
  `process.env.FIGMA_API_KEY` presence (or, if unavailable, the
  managed `~/.copilot-skills-pack/.env` file existence — never read
  the token value into chat output).
- **Writes:** `state.lastMcpProbeAt` (top-level, ISO timestamp).

## Behavioral example

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

## Honest constraints

- The probe is **best-effort**: a 3-second timeout will mark a slow
  server as unreachable. Re-running is cheap.
- The MCP `tools/list` shape is the discovery contract; if a server
  exposes a different discovery surface, list whatever tool names are
  visible without inventing them.
- Never echo the full PAT, even when "the user explicitly asks."
  Redirect: *"For security, I don't print the full token. Check
  `~/.copilot-skills-pack/.env` directly if you need to copy it."*
