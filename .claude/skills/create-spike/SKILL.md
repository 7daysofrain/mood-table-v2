---
name: create-spike
description: Shape a Mood Table spike in Linear and leave it in Todo, ready to start. Creates it from an epic (a planned spike, e.g. from an assumption or open question of the source document) or completes an issue that already exists (a capture accepted as Spike, or a spike created earlier). Writes the questions, the timebox the user sets, the expected deliverable, non-goals and the Spike DoD. Entry of the spike lane; /close-spike is its exit.
argument-hint: <epic-id | issue-id> [idea]
disable-model-invocation: true
---

# Create spike

Entry of the **spike lane** (`docs/instructions/workflow.md` §7): **`/create-spike` → experiment →
`/close-spike`**. A spike is **a question with a timebox**, not a behaviour. That is why it does not go
through `/create-story`, `/refine-story` and `/estimate-story`: a happy path, GIVEN/WHEN/THEN, INVEST
and planning poker are tools for behaviour, and forcing a question through them wastes the user's time
on something that is meant to be quick.

A spike reaches this skill from one of two places:

- **An epic.** The spike is planned: it comes from an assumption (A#/BA#) or open question (Q#/BQ#) of
  the source document, a risk in the ficha, or the refinement of a story that needs an answer first.
  The skill creates the issue.
- **An issue that already exists.** Usually a capture (`/capture`) that the user accepted as `Spike`
  in Linear's Triage inbox; also a spike created before this lane existed. The skill completes it.

It ends with the spike in **Todo**, with no estimate: the timebox replaces it. There are no tasks
under a spike: the spike itself is the unit of work, with one branch and one PR.

Input: `$ARGUMENTS` = an epic ID or an issue ID and, optionally, the idea in the user's words.

## Language

Instructions here are in English, but **talk to the user in Spanish and write all Linear content in
Spanish**, using the glossary of the epic's source document. A term that is not there is proposed for
the glossary before it is used.

## Steps

1. **Load context.**
   - The issue (`get_issue`) and work out which case it is:
     - an **epic** (a parent issue whose title starts with `H#`, `S#`, `PB` or `EN`): a new spike. Also
       list its sub-issues (`list_issues` with `parentId`), to avoid duplicating a spike or story that
       already asks the same thing;
     - an issue labelled **`Spike`**: complete it. Load its epic too;
     - an issue still in **Triage**: stop. It has to be classified first, by hand, in Linear (accept it
       with the `Spike` label and an epic). Classifying is the user's call, not this skill's;
     - an issue with **another type label** (`Feature`, `Bug`…): stop and say it is not a spike. If the
       user thinks it is one, they change the label first.
   - `docs/instructions/workflow.md` §3 (the table of source documents) and §7 (the spike lane), and
     `docs/instructions/linear.md` §3-§4 (labels, timebox).
   - **The epic's source document**, read through the table, never by a section number you remember:
     its assumptions, open questions, constraints and glossary. These are what a spike usually
     answers. `EN` has no source document: trace the questions to the issue itself and to the
     decisions in `docs/idea-mood-table.md`.

2. **The questions.** A spike answers **one to three questions**. More than three usually means two
   spikes: propose splitting it.
   - **Existing issue:** derive the questions from its description (for a capture, its «Qué», quoting
     the user, and its «Evidencia»). Do not ask the user to rewrite them: they already said what they
     needed when they captured it, and asking again is the interruption the lane exists to avoid.
     Show your wording so they can correct it.
   - **New spike:** start from the idea in `$ARGUMENTS`, or ask for it in one line. Keep the user's
     intent; your job is to phrase it as questions, not to choose them.

   Write each question so that **data can answer it** (a measurement, a prototype, sources) and next
   to it **what the answer feeds**: the decision it settles, the A#/Q# it closes, the story it
   unblocks. A question that feeds nothing is curiosity, not a spike: point it out.

3. **Missing questions.** Check the questions against the source document (its assumptions, open
   questions and constraints) and the issue's evidence. Offer **at most three** missing questions or
   things to leave out, each with its source, and let the user keep or drop each one. Do not add any
   by yourself.

4. **Timebox.** Ask the user for it: **½, 1 or 2 days** of dedicated work. Do not propose a value: the
   user sets it, and a number from you would anchor them. More than 2 days means more than one
   question's worth of work: propose splitting the spike, as a 13 splits a story.

5. **Deliverable.** In one or two lines: which decision is expected and where it will land. Usually a
   D# in `docs/idea-mood-table.md`, the A#/Q# it updates, the document in `docs/spikes/`, and the
   stories or captures that come out of it. This is what `/close-spike` will check against.

6. **Non-goals (2-4).** What the spike will not answer or build. Production code is always one of
   them: anything that should stay goes through the normal lane afterwards (a capture or a story).
   Take the rest from the source document and from sibling stories and spikes.

7. **New spike only: title, labels, priority and relations.**
   - **Title:** in Spanish, an imperative verb of investigation plus what it finds out («Medir si la
     Pi aguanta el motor en tiempo real», «Probar qué protege la mesa de los desenchufados»).
   - **Labels:** `Spike` and **one** area (`engine`, `panel`, `shared`, `db`, `infra`, `firmware`).
   - **Priority** (Urgent/High/Medium/Low), with a short reason.
   - **Blocks:** the story or stories that wait for its answer, if any.

8. **Definition of Done.** Copy **verbatim** the block in [`assets/dod.md`](assets/dod.md). It is in
   Spanish because it goes straight into Linear, and copying it unchanged keeps every spike's DoD the
   same.

9. **Human gate.** Build the description from [`assets/spike.md`](assets/spike.md) and show it, with
   the title, labels, priority and relations if it is a new spike. For an existing issue, its current
   description goes under **Contexto** unchanged, except a capture's «Clasificación sugerida», which
   the classification already settled. Nothing is written to Linear until the user approves.

10. **Save to Linear.**
    - **New spike:** `save_issue` without `id`: `team` and `project` Mood Table, `parentId` the epic,
      the labels and priority, `state` Todo, no `estimate`, and the `blocks` relations.
    - **Existing issue:** `save_issue` with its `id`: the new description and `state` Todo. Leave the
      labels, priority and epic the classification gave it. If it has an estimate from before this
      lane, tell the user rather than clearing it yourself.
    - Close with the link and what comes next: a branch from `main` named after the issue (Linear's
      suggested name), a draft PR with the first commit (that moves it to *In Progress*), the
      prototype in `.spikes/moo-n/`, as simple as it can be; and, when it is done, `/close-spike <id>`.
