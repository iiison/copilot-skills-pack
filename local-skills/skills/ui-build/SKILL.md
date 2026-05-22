# /ui-build

Execute one task at a time from the plan, with a mandatory contract
gate in re-skin mode and explicit pre / post self-checks on every file
that touches a `PRESERVE` range.

## Inputs

- None — uses session state.
- **`--task=<N>`** *(optional)*: a 1-based task index from
  `docs/ui/plans/<slug>.md`. Jumps to task `N` instead of using
  `state.inProgress.currentTaskIndex`.

  - If `N` **exceeds** the plan's task count, halt:

    > *"Task `<N>` doesn't exist. The plan has `<total>` tasks
    > (1–`<total>`). Run `/ui-plan` if you've added new tasks."*

  - If task `N` is **already built** (its target file exists and
    substantively matches the plan's acceptance criteria for that
    task), halt:

    > *"Task `<N>` appears already built (file `<path>` exists and
    > matches the plan). Pass `--task=<N> --force` to rebuild, or
    > pick a different task."*

  - **`--force`** (alongside `--task=<N>`) suppresses the already-built
    check.

- **`--target=<path>`** is **ignored** at build time. Re-skin mode is
  determined by **the contract's presence**, not a flag. If supplied,
  confirm it matches the contract's target and proceed.

## Preconditions

- `state.inProgress.phase === "planned"`.
- **If re-skin mode:** `state.inProgress.contractApproved === true`
  **and** `docs/ui/contracts/<slug>.md` exists.

## Behavior

1. **Intro (first message of the invocation).** Emit the discoverability
   hint:

   > *"Tip: pass `--target=<path>` (or attach a file with `#file:`) to
   > any `/ui-refine` or `/ui-build` invocation to re-skin existing
   > code instead of generating from scratch. Pass `--task=<N>` to
   > `/ui-build` to jump to a specific task in the plan."*

2. **Mandatory contract gate (re-skin only).** Before any generation,
   **re-read the contract file from disk** — **not** from session state.
   The file is the source of truth. If the file is missing or
   `contractApproved !== true`, halt with:

   > **`/ui-build` halted.** Re-skin mode requires an approved
   > Preserve/Replace contract. Run `/ui-spec` first and approve the
   > contract before retrying.

3. **First-run preference checks.** If
   `state.preferences.generateTests === null` (unasked), ask:

   > *"Generate tests for components in this build? (y/n)"*

   Persist the answer.

4. **For each task**, starting at the index from step 1 or
   `currentTaskIndex` otherwise:

   a. Re-read the relevant **spec**, **plan task**, and (if re-skin) the
      **contract**.

   b. **Pre-emit self-check** *(re-skin only)*. Re-read the target
      file from disk. For each top-level statement in `PRESERVE`,
      identify its exact byte range. Hold this as "do-not-touch."

   c. **Generate the file.** Apply repo guide token discipline and
      reuse rules. Emit the file content.

   d. **Post-emit self-check** *(re-skin only)*. Diff the generated
      content against the original target file. For every changed
      line, **verify** it falls within a `REPLACE` range — **not** a
      `PRESERVE` range. If a `PRESERVE` range was touched, halt:

      > **Contract violation detected.** Generation would modify a
      > PRESERVE range:
      >
      > `<file>:<line-start>-<line-end>` — original: `<snippet>`
      >
      > This is forbidden. Aborting this task. Re-run `/ui-spec` to
      > revise the contract or amend the design.

      Acknowledge (spec §8.4): the diff check is **LLM reasoning over
      text**, not a deterministic tool. The mitigation is the explicit
      pre / post check — always emit the verification, never skip it.

   e. **Test generation (if opted in).** Generate
      `<Component>.test.tsx` using
      `state.preferences.testingLibrary` and
      `state.preferences.testFileConvention` (defaults: vitest +
      @testing-library/react, colocated).

   f. **Commit prompt.** Output:

      > *"Task `N` complete. Stage and commit? Suggested message:
      > `feat(ui): add <ComponentName>` (or
      > `style(ui): re-skin <file> per contract`). Then run
      > `/ui-build` again for task `N+1`."*

      **Do not** run git commands. The developer does.

   g. Update `state.inProgress.currentTaskIndex++`. If this is the
      last task, set `phase = "built"` and emit a workflow summary.

## Outputs

- One or more `.tsx` files at paths defined by `/ui-plan`.
- Optional `.test.tsx` files alongside (or in `__tests__/`, per
  `state.preferences.testFileConvention`).
- Updated `docs/ui/.session-state.json`.

## Failure modes

- **Preconditions not met** → halt with the gate message.
- **Contract violation** (re-skin) → halt with the violation message;
  **do not** write the file.
- **Tailwind config doesn't include a referenced token** → emit the
  file but flag the missing token at the top of chat output and add a
  `// TODO: add token <name>` comment in the generated file. Surface
  the gap to the developer for inclusion in the next `/ui-learn` pass.
- **Mid-build correction** (developer's next message contradicts the
  just-emitted file) → trigger the mid-correction learning rule from
  the `frontend-craftsman` persona. This learning-prompt path only
  fires when the chat is in that persona (spec §5.3).

## Session-state interactions

- **Reads:** `inProgress.workflows[<slug>].*`,
  `preferences.generateTests`, `preferences.testingLibrary`,
  `preferences.testFileConvention`.
- **Writes:** `inProgress.workflows[<slug>].currentTaskIndex`,
  `inProgress.workflows[<slug>].phase`,
  `preferences.generateTests` (on first answer).

## Behavioral example (re-skin task)

```
User: /ui-build
Agent: Task 3: re-skin app/pricing/page.tsx per contracts/pricing-page.md.
       Re-read contract: ✓ approved.
       Pre-emit self-check: 8 PRESERVE ranges identified.
       [emits new page.tsx]
       Post-emit self-check:
         ✓ All PRESERVE ranges intact (lines 1-22, 47-58, 71-89, ...).
         ✓ REPLACE applied to lines 24-45 (JSX shell) and 60-69 (tier map).
       Tests: skipped (preference: off).
       Task 3 complete. Stage and commit?
       Suggested: `style(ui): re-skin app/pricing/page.tsx per contract`
       Run /ui-build again to continue (no more tasks remain — workflow complete).
```

## Honest constraints (spec §8.4)

- Pre / post self-checks are **LLM reasoning over text**. They are
  effective **because** the verification table is emitted explicitly
  on every task; never paraphrase it away.
- The "already built" check is heuristic — file presence plus a
  textual match against the plan's acceptance criteria. `--force`
  exists precisely for the false-positive case.
- Do not `git add`, `git commit`, or shell out for VCS operations
  from this command. The developer always controls history.
