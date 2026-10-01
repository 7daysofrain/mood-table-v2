# AGENTS.md

**Mood Table**: a light instrument for a DJ table. A TypeScript engine without a browser paints N LED
strips (physical over Adalight serial, virtual over WebSocket) with audio-reactive or ambient effects,
controlled live from a web panel it serves. Final project of the AI4Devs master (LIDR) by Joseba Alonso.
Repo: `github.com/7daysofrain/mood-table-v2` (public).

Read before working on product or design questions: [`docs/PRD.md`](docs/PRD.md) (source of truth for
*what* and *why*; glossary in §8), [`readme.md`](readme.md) (architecture, data model, stories, tickets)
and [`docs/idea-mood-table.md`](docs/idea-mood-table.md) §10 (decisions D1-D36 with their rationale).

Stack (rationale in README §2.1): pnpm workspaces monorepo (`packages/shared`, `engine`, `panel`) ·
TypeScript strict · Fastify + TypeBox (OpenAPI from schemas) · React + Vite · SQLite for instrument
state · Vitest · Playwright · GitHub Actions + SonarQube Cloud · OpenSpec for SDD.

## Working rules (non-negotiable)

1. **Near-production product, not a PoC.** Complete before extensive: one closed, excellent flow beats
   broad coverage. Quality may take longer than the course's ~30 h estimate.
2. **Aim for the grade.** The three evaluation axes (idea and architecture, code quality, use of AI
   across the process) drive decisions. Check every delivery against all its criteria before calling
   it done.
3. **Learning over speed.** The user takes part in ideation, creation and direction. Propose, but **do
   not take the initiative without asking first**. Always explain the *why*.
4. **Critical thinking.** Do not agree by default. When a decision has grey areas or risks, **stop and
   say so**, with reasoning and alternatives.

## Instructions index (`docs/instructions/`)

Read a file **when its "When" column applies**, not all of them up front.

| File | Contents | When |
|---|---|---|
| [`workflow.md`](docs/instructions/workflow.md) | PRD → epic → story → task → OpenSpec → PR chain; task = PR, step = commit; source of truth for each thing | Before creating or touching epics, stories, tasks or specs, and before opening a PR |
| [`linear.md`](docs/instructions/linear.md) | Linear conventions: single project, epic = parent issue, states, labels, estimation, branches, MCP permissions | Before creating or editing anything in Linear, and before creating a branch |
| [`course.md`](docs/instructions/course.md) | Master's requirements: scope, evaluation axes, deliveries and their mechanics, methodology, `prompts.md` format | When preparing or checking a delivery, deciding scope, or recording prompts |

Thresholds to turn into numbers in the engine spec: [`docs/umbrales-para-specs.md`](docs/umbrales-para-specs.md).

## Harness conventions (`.claude/`, `docs/instructions/`)

- **Harness in English** (skills, subagents, names, this file); **product documents and Linear content
  in Spanish**, bridged by the PRD glossary (§8). Skills address "the user", not a specific person.
  The dividing line: **what the user reviews and approves is in Spanish, even when an agent writes or
  consumes it** (OpenSpec artifacts included); instructions that only an agent reads are in English.
- **`docs/instructions/` = the what** (cross-cutting conventions and flow); **skills = the how**
  (protocol, templates, DoD).
- **What only one skill uses lives in its folder** (`references/` or `assets/`), not in `docs/`.
- One `AGENTS.md` at the root for now; per-package files are considered with the monorepo (`MOO-28`).

## Tools

- **Cowork:** ideation, research, decisions, critical review and writing documents. Drafts go to
  `docs/borradores/` (git-ignored) and move to the README once validated.
- **Claude Code:** everything that touches the repo *as a repo*: branches, commits, PRs, running code and
  tests, OpenSpec commands, and all implementation work.
- **Never run git from Cowork:** its bridge cannot delete files and leaves an orphan `.git/index.lock`
  (fix: `rm .git/index.lock`).
- **Record AI usage as you go:** when a README section or a harness milestone closes, add it to
  `prompts.md` (format in `course.md` §5). It is a third of the grade.

## Don't

- Don't copy information between sources of truth; link instead (`workflow.md` §3).
- Don't invent acceptance criteria or use terms outside the PRD glossary (`workflow.md` §5).
- Don't mix two tasks in one PR or two steps in one commit.
- Don't write to Linear outside the `ask` gate (`linear.md` §8).

## Current state

*Rewrite this section when it changes; history lives in git.*

- **Delivery 1** sent on 24-sep-2026 (branch `feature/entrega-1-JA`, merged into `main`).
- **Delivery 2** due **23-oct-2026** on `feature/entrega-2-JA`: scaffolds front + back + DB connected,
  main flow nearly complete, README §4 (OpenAPI).
- **Next steps, in order:**
  1. `MOO-31`: initialise and configure OpenSpec (in progress).
  2. `MOO-28`: monorepo, lint, tests and CI; first change through the full OpenSpec flow. Pin the
     OpenSpec CLI as a dev dependency there.
  3. `MOO-12`: performance spike on the Pi 3 B+ (ms/frame at 200/300/600 LEDs). It gates the engine
     spec (D8, D13) and the MVP LED count (≤ 200-300 via Adalight, D12). Needs the Pi, strip and Light Box.
  4. `MOO-29`: panel layout.
  5. `MOO-13`: first OpenSpec change → tasks `MOO-16`/`MOO-17`/`MOO-18`; README §4 with the code.
  6. Refine `MOO-22` (hear the file) and `MOO-25` (H5) just in time.
- **Open items:**
  - User: invite the evaluator to the Linear workspace (README links to it) · fix the claude.ai Project
    instructions ("7 numbered docs" → `readme.md` with 8 sections + `prompts.md`) · check that Cowork
    resolves `@AGENTS.md` · archive the old fork on GitHub (optional).
  - Docs: `HARDWARE_SETUP.md` at the root, promised in README §1.4 (the user reviews it carefully: wiring
    mistakes burn hardware) · the wireframe (`docs/img/panel-wireframe.png`) still says "Tira virtual"
    where the PRD says *visor*.
  - Harness: `validate-ac` hook · skill-creator evals for the three story skills · review `workflow.md` §4
    against the what/how rule · decide whether `save_issue` moves from `ask` to `allow` · migrate
    `docs/instructions/` to English.
