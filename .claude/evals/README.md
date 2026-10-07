# Evals of the story skills

Evals for `/create-story`, `/refine-story` and `/estimate-story`, run with skill-creator. Each skill
keeps its own cases in `.claude/skills/<skill>/evals/evals.json`; this folder holds what they share.

| Path | Contents | In git |
|---|---|---|
| `environment.md` | Instructions every eval run follows: Linear is replaced by the fixtures | Yes |
| `linear/` | Frozen snapshots of Linear issues, in the shape the Linear MCP returns them | Yes |
| `workspace/<skill>/` | skill-creator runs (`iteration-N/…`, benchmark, viewer) | No |

The workspace lives here and not next to the skill (skill-creator's default) because a run may copy
the skill, `SKILL.md` included, into it; under `.claude/skills/` that copy could be loaded as a skill.

## Fixtures

Snapshots taken from Linear on 2026-10-07. They are frozen on purpose: an eval must give the same
input every time, and the real issues keep changing.

| File | Issue | Used by |
|---|---|---|
| `MOO-5.json` | Epic H1 | create-story, refine-story |
| `MOO-5.children.json` | Sub-issues of MOO-5 (`list_issues` with `parentId`) | create-story |
| `MOO-22.json` | Story in Backlog, not refined | refine-story, estimate-story |
| `MOO-14.json` | Refined story, **before** estimation (see below) | estimate-story |
| `MOO-14.children.json` | Its tasks MOO-19, MOO-20, MOO-21 | estimate-story |

`MOO-14.json` is the real issue rolled back to the moment before `/estimate-story`: state Backlog, no
`estimate`, and without the `**Estimación:**` line.

In every fixture, the MCP's `<issue id=… href=…>MOO-n</issue>` links are flattened to the plain
`MOO-n`, and fields the skills do not read (UUIDs, URLs, timestamps, state history) are left out.
Everything else is verbatim.
