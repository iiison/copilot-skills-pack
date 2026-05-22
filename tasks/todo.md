# Todo — Figma → React UI Skill Suite

> Mirrors [docs/plans/figma-to-react-skill-plan.md](../docs/plans/figma-to-react-skill-plan.md). One checkbox per task. Open the plan for acceptance criteria, verification steps, and risks.

## Phase A — Installer foundation

- [ ] **T1 (XS)** Define multi-source `skills.config.json` schema → `skills.schema.json`
- [ ] **T2 (S)** Implement legacy-config migration in `setup.mjs`
- [ ] **T3 (S)** Implement multi-source `resolveSourceDir()` + `.cache/` rename
- [ ] **T4 (S)** Extend `syncSourceRepo()` to iterate `sources[]`
- [ ] **T5 (S)** Thread `source` through `installInstructions` and `installPrompts`
- [ ] **T6 (M)** Thread `source` through `installSlashCommands` and `installPersonas`
- [ ] **T7 (XS)** Name-collision warning + later-wins ordering
- [ ] **T8 (XS)** Update `printNextSteps`, `--help`, CLI option docs
- [ ] **T9 (XS)** Migrate `skills.config.json` to multi-source schema (committed)
- [ ] **Checkpoint A** — Migration no-op on second run; all 20 upstream skills install; `--uninstall` scoped

## Phase B — MCP installation

- [ ] **T10 (XS)** Pin `figma-developer-mcp` in `package.json` (+ lockfile, `.gitignore`)
- [ ] **T11 (XS)** Implement MCP config-path resolver per editor target
- [ ] **T12 (S)** Read, parse, back up `mcp.json` (JSONC-tolerant)
- [ ] **T13 (S)** Register `figma-dev-mode` + `figma-framelink` entries with sentinel
- [ ] **T14 (S)** PAT prompt + `~/.copilot-skills-pack/.env` write at mode `0600`
- [ ] **T15 (XS)** Dev Mode reachability probe (non-fatal, 3s timeout)
- [ ] **T16 (S)** Extend `--uninstall` to remove managed MCP entries
- [ ] **T17 (XS)** Installer help text + `--dry-run` parity for MCP mutations
- [ ] **Checkpoint B** — Clean install registers both; second run no-op; uninstall scoped; PAT never logged

## Phase C — Skill authoring

- [ ] **T18 (XS)** Create `local-skills/` directory layout
- [ ] **T19 (S)** Author `ui-conventions` always-on instruction
- [ ] **T20 (M)** Author `frontend-craftsman` persona (+ §6.2 state appendix)
- [ ] **T21 (M)** Author `/ui-learn` (+ §6.1 / §6.1.1 templates)
- [ ] **T22 (S)** Author `/ui-mcp-status` (early — for debugging)
- [ ] **T23 (M)** Author `/ui-refine` (+ §6.4 / §6.5 templates)
- [ ] **T24 (M)** Author `/ui-spec` (+ §6.3 contract + §6.3.2 enumeration)
- [ ] **T25 (S)** Author `/ui-plan`
- [ ] **T26 (M)** Author `/ui-build` (+ `--task=N` validation + self-checks)
- [ ] **T27 (S)** Author `/ui-flag`
- [ ] **T28 (XS)** Register 9 entries in `skills.config.json`
- [ ] **T29 (S)** Greenfield smoke test fixture + script
- [ ] **T30 (S)** Mid-maturity smoke test fixture + script
- [ ] **Checkpoint C** — All commands in `/` picker; persona in mode dropdown; both smoke tests pass

## Phase D — Docs + pilot

- [ ] **T31 (S)** README "Figma → React" section
- [ ] **T32 (XS)** Lifecycle diagram for UI workflow
- [ ] **T33 (S)** Examples gallery — greenfield walkthrough
- [ ] **T34 (S)** Examples gallery — re-skin walkthrough
- [ ] **T35 (S)** Troubleshooting page for Figma MCP setup
- [ ] **T36 (S)** HOW_TO_USE.md additions
- [ ] **T37 (S)** Pilot — greenfield repo
- [ ] **T38 (S)** Pilot — mid-maturity repo
- [ ] **T39 (S)** Pilot — mature design-system repo
- [ ] **T40 (S)** Resolve or defer Open Questions; finalize spec §10
- [ ] **Checkpoint D** — Docs merged; 3 pilots logged; spec §10 fully resolved or deferred with rationale

---

## Size tally

- **XS:** 11 — T1, T7, T8, T9, T10, T11, T15, T17, T18, T28, T32
- **S:** 23 — T2, T3, T4, T5, T12, T13, T14, T16, T19, T22, T25, T27, T29, T30, T31, T33, T34, T35, T36, T37, T38, T39, T40
- **M:** 6 — T6, T20, T21, T23, T24, T26
- **Total:** 40

## Critical path (18 tasks)

T1 → T2 → T3 → T5 → T6 → T18 → T19 → T20 → T21 → T23 → T24 → T25 → T26 → T28 → T31 → T36 → T37 → T40

## Top-3 risks

1. **T14** — PAT handling; one mistake leaks the token.
2. **T13** — Wrong MCP `args` or missing sentinel breaks Framelink globally.
3. **T20** — `frontend-craftsman` persona drives the whole suite's UX.

## Blocking open questions before Phase A starts

None. Q#3 (JSONC parser choice) can be decided during T12.
