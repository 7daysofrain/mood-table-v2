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

## Running the evals

Follow skill-creator's "Running and evaluating test cases", with two adjustments for this repo:

- **Runs:** one subagent per case and configuration (`with_skill` reads `.claude/skills/<skill>/SKILL.md`;
  `without_skill` must not read `.claude/skills/` or `.claude/agents/`). Both read `environment.md`,
  and their outputs directory is the `<outputs>` it mentions.
- **Layout:** skill-creator's two scripts expect different shapes, so use one that satisfies both:

  ```
  workspace/<skill>/iteration-N/
  ├── benchmark.json · benchmark.md · review.html
  └── eval-<id>-<name>/
      ├── eval_metadata.json
      └── with_skill/ · without_skill/
          ├── eval_metadata.json      # copy: the viewer only looks here or in run-1/
          └── run-1/
              ├── outputs/            # transcript.md, linear-writes.json, subagent-prompts.md
              ├── grading.json        # expectations[]: text, passed, evidence
              └── timing.json
  ```

  `aggregate_benchmark` needs `eval-*/<config>/run-*/`; `generate_review.py` shows "No prompt found"
  unless `eval_metadata.json` sits in `<config>/` or `run-1/`.
- **Viewer:** `generate_review.py … --static <workspace>/iteration-N/review.html`, so no server stays up.

## Validating the skills' form

skill-creator's `scripts/quick_validate.py` checks the portable Agent Skills spec (what claude.ai and
the API accept on upload), which allows only six frontmatter keys. Our three skills also use two keys
that are **Claude Code's own** and documented: `argument-hint` (the autocomplete hint) and
`disable-model-invocation` (the skills only run when the user types them, so the model never writes to
Linear on its own). The validator rejects both; that is expected, and they must stay.

To check everything else, validate a copy without those two lines:

```bash
rm -rf /tmp/qv-<skill> && cp -R .claude/skills/<skill> /tmp/qv-<skill>   # fresh copy, never nested
sed -i.bak '/^argument-hint:/d;/^disable-model-invocation:/d' /tmp/qv-<skill>/SKILL.md   # BSD and GNU sed
python -m scripts.quick_validate /tmp/qv-<skill>   # from the skill-creator folder; needs PyYAML
```

Baseline (2026-10-07): the three pass ("Skill is valid!"), with `SKILL.md` between 55 and 91 lines.

## Fixtures

Snapshots taken from Linear on 2026-10-07. They are frozen on purpose: an eval must give the same
input every time, and the real issues keep changing.

| File | Issue | Used by |
|---|---|---|
| `MOO-5.json` | Epic H1 | create-story, refine-story |
| `MOO-5.children.json` | Sub-issues of MOO-5 (`list_issues` with `parentId`) | create-story, poke-holes |
| `team.json` | The team's stories (`list_issues` without `parentId`); the same ones as above | estimator |
| `MOO-22.json` | Story in Backlog, not refined | refine-story, estimate-story |
| `MOO-14.json` | Refined story, **before** estimation (see below) | estimate-story |
| `MOO-14.children.json` | Its tasks MOO-19, MOO-20, MOO-21 | estimate-story |
| `MOO-901.json` | **Synthetic**: a story under H1 that is far too big (fails INVEST) | refine-story |

IDs from `MOO-900` up are synthetic: no real issue has them, so a fixture can never be mistaken for a
snapshot.

`MOO-14.json` is the real issue rolled back to the moment before `/estimate-story`: state Backlog, no
`estimate`, and without the `**Estimación:**` line. It appears unestimated in the lists too
(`MOO-5.children.json`, `team.json`): the `estimator` calibrates against the estimated stories, and
would otherwise read the real card.

In every fixture, the MCP's `<issue id=… href=…>MOO-n</issue>` links are flattened to the plain
`MOO-n`, and fields the skills do not read (UUIDs, URLs, timestamps, state history) are left out.
Everything else is verbatim.
