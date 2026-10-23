---
name: create-story
description: Create one or more user stories in Linear as sub-issues of a Mood Table epic with a source document (the product epics H1-H5 and S1-S2, from the PRD, or PB, from docs/pr-babysitter.md), left in Backlog with As/I want/So that, non-goals, labels, priority and an AI t-shirt size. First step of the create-story → refine-story → estimate-story flow.
argument-hint: <epic-id> [story idea | list of ideas]
disable-model-invocation: true
---

# Create story

First step of the flow **`/create-story` → `/refine-story` → `/estimate-story`**. It fills the backlog:
each story ends up in **Backlog** with its intent and scope, but **without acceptance criteria and
without a Fibonacci estimate**. Those come later, in separate steps, on purpose: the course (module 4)
warns that writing and estimating in the same breath anchors the estimate, and that criteria written
by the AI end up generic.

Input: `$ARGUMENTS` = epic ID and, optionally, one or more story ideas. It works in batch, but the
user validates every story before anything is written to Linear.

## Language

Instructions here are in English, but **talk to the user in Spanish and write all Linear content in
Spanish**. The project writes documents in Spanish and code in English, and the glossary of the epic's
source document maps one to the other. Use its terms. If you need a term that is not there, propose
adding it to that glossary before using it, so the vocabulary does not drift.

## Steps

1. **Load context.**
   - `docs/instructions/linear.md`: §1, §3-§5 (structure, labels, estimation rules, the flow).
   - With the `linear` MCP, the epic (`get_issue`) and its existing sub-issues (`list_issues` with
     `parentId`). You need both to avoid duplicating a story that already exists.
   - **The epic's source document.** The prefix of the epic's title (`H1`, `S2`, `PB`…) tells you which
     one it is, and the table of source documents in `docs/instructions/workflow.md` §3 says where
     each part lives in it. Read the parts you need through that table, never by a section number you
     remember: the epic's story or stories (its H#/S#, or the BH# for PB), its expectations, scope,
     users, open questions and glossary. If the epic is not in the table (e.g. EN, whose tasks hang
     without a story, `linear.md` §1), stop and say so.
     That document is the source of truth. If something you want to write is not backed by it, mark
     it *(asumido)* instead of presenting it as fact.

2. **Propose.** Use a table when there are several stories. For each one:
   - **Title:** short and in Spanish, describing the observable behaviour, with no H#/BH# prefix.
   - **Como / quiero / para:** the user role comes from the source document's users.
   - **Non-goals (2-4):** take them from the source document's vision and out-by-decision parts, from
     the document's other stories (another H#/S#, or another BH#) and from what sibling stories already
     cover. Explicit non-goals keep an implementing agent from over-building.
   - **Talla (IA):** XS · S · M · L · XL, with a one-line reason. It is only a coarse signal to help
     prioritise, not the estimate.
   - **Labels:** one type (usually `Feature`) and the area(s) (`engine`, `panel`, `shared`, `db`,
     `infra`, `firmware`).
   - **Priority** (Urgent/High/Medium/Low), with a short reason.

   Keep each story at a size of 1-2 days of observable behaviour. If an idea is clearly bigger, propose
   splitting it now. That is cheaper than discovering it at estimation time.

3. **Human gate.** Show the proposal and wait for the user to validate, edit or drop each story.
   Nothing goes to Linear without explicit approval, because every story created here becomes work
   that someone will plan around.

4. **Create in Linear.** For each approved story, call `save_issue` without `id`:
   - `team` and `project`: Mood Table;
   - `parentId`: the epic;
   - `state`: Backlog; no `estimate`;
   - the approved `priority` and `labels`.

   The `description` is [`assets/story.md`](assets/story.md) filled in. This skill owns the
   **Historia** and **Non-goals** sections; `/refine-story` and `/estimate-story` add theirs later
   without rewriting these, so keep the headings exactly as they are.

5. **Close.** List the created IDs with their links and point to the next step: `/refine-story <id>`.
