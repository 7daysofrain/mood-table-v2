# AGENTS.md

**Mood Table**: a light instrument for a DJ table. A TypeScript engine without a browser paints N LED
strips (physical over Adalight serial, virtual over WebSocket) with audio-reactive or ambient effects,
controlled live from a web panel it serves. Final project of the AI4Devs master (LIDR) by Joseba Alonso.
Repo: `github.com/7daysofrain/mood-table-v2` (public).

Read before working on product or design questions: [`docs/PRD.md`](docs/PRD.md) (source of truth for
*what* and *why*; glossary in §8), [`readme.md`](readme.md) (architecture, data model, stories, tickets)
and [`docs/idea-mood-table.md`](docs/idea-mood-table.md) §10 (decisions D1-D39 with their rationale).

Stack (rationale in README §2.1): pnpm workspaces monorepo (`packages/shared`, `engine`, `panel`) ·
TypeScript strict · Fastify + TypeBox (OpenAPI from schemas) · React + Vite · SQLite for instrument
state · Vitest · Playwright · GitHub Actions + SonarQube Cloud · OpenSpec for SDD.

## Commands (from the repo root)

Node 24 (`.nvmrc`; `nvm use`) and pnpm from `packageManager` (`corepack enable`, or `corepack pnpm`).
CI runs these same scripts, so a green run locally predicts a green PR.

| Command | Does |
|---|---|
| `pnpm install` | Installs everything; fails on a Node version other than 24 (`engineStrict`) |
| `pnpm lint` | ESLint with type information, including the **boundary rule** (`specs/module-boundaries`) |
| `pnpm typecheck` | `tsc --noEmit` in the root and in every package |
| `pnpm test` / `pnpm test:coverage` | Vitest across all packages; coverage goes to a single `coverage/lcov.info` |
| `pnpm exec openspec …` | The pinned OpenSpec CLI (1.14.0), not the global one |

Code conventions the tooling enforces or relies on:

- **Boundaries:** `engine/src/core` never imports `engine/src/adapters`; only `engine/src/main.ts` sees
  both. `panel` imports only `@moodtable/shared`, and only through its entry point. Lint fails otherwise.
- **Hardware I/O goes in `*.hardware.ts`** (opening the serial port, spawning `arecord`); keep the pure
  part (e.g. Adalight encoding) in a normal, tested file. `*.hardware.ts` and both `main` files are
  excluded from coverage.
- Shared dependency versions live in the pnpm **catalog** (`pnpm-workspace.yaml`); packages use
  `"catalog:"`.

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
| [`linear.md`](docs/instructions/linear.md) | Linear conventions: single project, epic = parent issue, states, labels, estimation, branches and the PR base branch, MCP permissions | Before creating or editing anything in Linear, before creating a branch, and before opening a PR |
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

## Where the work stands

Not in this file: it is loaded in every session and would go stale.

- **Status, order and blockers:** Linear, project *Mood Table* (priority and *blocks* relations). Read
  it through the Linear MCP before choosing what to work on.
- **Current delivery, its deadline and its branch:** `docs/instructions/course.md` §3. Task PRs
  target the delivery branch, not `main` (`linear.md` §7).
- **Pending items** (docs, harness, the user's own): issues in Linear, not lists here.
