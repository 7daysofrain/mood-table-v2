---
name: close-spike
description: Close a Mood Table spike that is in progress: write its verdict (the spike document in docs/spikes/, a new decision in the ficha, the source document's assumptions and open questions, prompts.md), note the time spent against the timebox, delete the prototype and link it from the PR, and mark the spike's PR ready for review. Exit of the spike lane that /create-spike opens.
argument-hint: <spike-id>
disable-model-invocation: true
---

# Close spike

Exit of the **spike lane** (`docs/instructions/workflow.md` §7): **`/create-spike` → experiment →
`/close-spike`**. The experiment was free work in the spike's branch, with a draft PR and no gates in
the way. This skill turns it into something that lasts: **a decision with its why**, written where the
project keeps decisions, and a PR whose diff is only that verdict. The prototype does not reach `main`:
it would rot against the real engine, and the evaluated repo would carry dead code. It stays reachable
through the PR.

The verdict is the most valuable part of a spike for the project and for the course (the D# and the
`prompts.md` entry are material for the AI-usage axis), so this skill is a careful checklist, not a
formality. **The decision is the user's**: you draft, they decide.

Input: `$ARGUMENTS` = the spike's ID.

## Language

Instructions here are in English, but **talk to the user in Spanish and write every document in
Spanish**, using the glossary of the epic's source document.

## Steps

1. **Load context and check where you are.**
   - The spike (`get_issue`): it must carry the `Spike` label. Read its questions, timebox,
     deliverable, non-goals and DoD: they are what you close against. If it has no **Preguntas** or
     **Timebox** section, it never went through `/create-spike`: say so and stop.
   - Its epic and the epic's source document, read through the table in `workflow.md` §3 (assumptions,
     open questions, glossary). `EN` has none.
   - **The branch and the PR.** The current branch must be the spike's (its ID is in the name), with
     an open draft PR (`gh pr view`). If you are on another branch, stop: closing from the wrong branch
     would delete or commit the wrong things. If there are uncommitted changes, ask whether they belong
     to the experiment before going on.
   - **What the experiment left:** the notes in `docs/spikes/`, the prototype in `.spikes/moo-n/` and
     its results, the branch's commits (`git log origin/main..HEAD`) and anything under `packages/`
     the experiment touched (`git diff --stat origin/main...HEAD -- packages/`).

2. **Answer each question.** For each question in the spike, draft one of two outcomes from what the
   experiment left, and show it to the user:
   - **Answered**, with the data that backs it (measurements, the prototype's result, sources). An
     answer without data is an opinion: if the data is not there, say what is missing.
   - **Closed without an answer**: what was learned and the question that remains. This is a valid
     outcome, not a failure. The question that remains becomes a Q# in the source document or a
     capture.

   Then draft the **verdict**: the decision the answers lead to, in one or two sentences, checked
   against the deliverable the spike promised. The user corrects or rewrites it. Do not move on until
   they approve it, because every later step writes it down.

3. **Time spent.** Ask the user how many days of dedicated work it took. It is noted next to the
   timebox, with nothing more: the timebox does not force anything, but the gap between the two is
   useful when planning the next spike.

4. **What comes out of it.** Propose the stories, bugs or chores the verdict opens, and any story the
   spike blocked that can now be refined. For each one the user keeps, give them a ready-made
   `/capture <texto>` line to run: captures are the user's to launch, and they go through the usual
   classification. Write them in the spike document too.

5. **Write the verdict** (one commit per document is fine; commits in a spike are free, with
   `Refs MOO-n`):
   - **The spike document**, `docs/spikes/moo-n-<tema>.md`, from
     [`assets/report.md`](assets/report.md). If the experiment already left notes there, build on them
     rather than starting again.
   - **A new D#** in `docs/idea-mood-table.md` with the decision and its why, in the format of the
     table's other rows. Take the next free number, and check open PRs for numbers already taken
     (`gh pr list --state open`, then their diffs of the ficha): two open PRs claiming the same D# is a
     merge conflict waiting to happen.
   - **The source document:** each assumption (A#/BA#) checked or refuted and each open question
     (Q#/BQ#) resolved, with the date and a link to the spike document. A new Q# for each question
     closed without an answer. Never delete or renumber an existing one: strike it and point to what
     replaces it.
   - **`readme.md`**, only if the verdict changes the system's design (the README holds design, not
     results).
   - **`prompts.md`**, if the AI took part, in the format of `docs/instructions/course.md` §5.

6. **Remove the prototype and link it.**
   - Take the SHA of the last commit that contains the prototype (`git log -1 --format=%H --
     .spikes/moo-n/`) and link it from the **Cómo repetirlo** section of the spike document:
     `https://github.com/<owner>/<repo>/tree/<sha>/.spikes/moo-n`. PRs are squash-merged, so the
     branch's commits never reach `main`; GitHub keeps every PR's commits, so the link survives the
     merge and the branch's deletion.
   - Delete `.spikes/moo-n/` in its own commit.
   - If the experiment touched `packages/`, show the user what changed and, with their OK, restore
     it from `main` (`git checkout origin/main -- <paths>`) in its own commit. Anything worth keeping
     goes through the normal lane as a capture or a story, with its change and tests; it is not
     rescued from the spike.
   - Check that the PR's diff against `main` is only the verdict (`git diff --stat
     origin/main...HEAD`): docs, `prompts.md` and maybe the README.

7. **Human gate.** Show the user the verdict, the D#, the list of changed files, the time against the
   timebox, the captures to launch and the DoD with each item checked or not, with the reason. A DoD
   item that is not met is the user's call: fix it, or close knowing it is open.

8. **Push and mark the PR ready.**
   - Push, and rewrite the PR description: `Fixes MOO-n` with the spike's ID, the verdict, the
     time against the timebox, the link to the prototype and the DoD as a checklist.
   - `gh pr ready`. From here on the PR follows `workflow.md` §4 like any other: gates, Codex's review
     of the last push, and every finding verified before it is fixed or answered. The user merges it,
     and the spike moves to *Done* by itself.
