# local-skills

Locally-authored skills installed by `setup.mjs` alongside the upstream
`addyosmani/agent-skills` set. Anything in this tree is referenced from
`skills.config.json` with `"source": "local"` (see `skills.schema.json`).

## Layout

```
local-skills/
├── agents/                       # persona / chat-mode bodies
│   └── <name>.md                 # installed as <name>.chatmode.md
└── skills/
    └── <name>/
        └── SKILL.md              # always-on instruction, on-demand prompt,
                                  # or slash-command body — category is
                                  # determined by where it is registered in
                                  # skills.config.json, not the file path
```

The installer adds the YAML frontmatter (e.g. `applyTo`, `mode: agent`,
`description`) per category; the `SKILL.md` / `<name>.md` files in this
tree should contain only the body — frontmatter, if present in the source,
is stripped on install.

## Convention

- File slug, directory name, and entry `name` in `skills.config.json` all
  match (e.g. slash command `/ui-build` ↔ `local-skills/skills/ui-build/SKILL.md`).
- See `docs/specs/figma-to-react-skill-spec.md` §2 for the full directory
  contract.
