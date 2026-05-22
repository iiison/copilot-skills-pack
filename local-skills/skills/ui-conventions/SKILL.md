# UI conventions

Applies to React + TypeScript + Tailwind UI files (`**/*.{tsx,ts,css}`).
Keeps generated UI consistent with the repo's design system.

## 1. Read-first rule

Before generating, modifying, or reviewing any React / TypeScript /
Tailwind UI code, read `docs/ui/repo-ui-guide.md` from the workspace
root **if it exists**. Treat it as authoritative on component reuse,
token usage, naming conventions, and the Learnings appendix.

If `docs/ui/repo-ui-guide.md` does **not** exist, do not proceed by
guessing. Recommend running `/ui-learn` before generating UI:

> *"I don't see `docs/ui/repo-ui-guide.md`. Run `/ui-learn` first so I
> can capture this repo's conventions, then I'll generate UI that
> matches."*

## 2. Token discipline

Do not introduce hardcoded color, spacing, or font-size values when the
guide identifies tokens for them. Use the guide's Token Map (Tailwind
utility classes or the named token paths it lists). If a needed token
is missing, **flag it to the developer** rather than inventing a value
— surface the gap so the Token Map stays the single source of truth.

## 3. Component reuse

Before creating a new component, check the guide's Component Inventory.
If an existing component covers the use case (even with minor
extensions), reuse it. If you must introduce a new primitive, note it
explicitly so it can be included in the next `/ui-learn` pass.

## 4. Learnings respect

The guide's `## Learnings` appendix is **binding**. If a learning says
"we use `Stack` not flex divs," do not emit flex divs — even if the
design appears to call for them. The Learnings appendix overrides any
inference from a single Figma frame.

## 5. Out-of-scope guardrail

These rules apply only to UI generation, modification, and review.
Do not block or modify non-UI code (routing, data fetching,
state management, server code) on the basis of this instruction.
