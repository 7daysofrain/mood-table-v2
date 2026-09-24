---
name: refine-story
description: Refine a Mood Table user story that is in Backlog in Linear. The user writes the happy path in GIVEN/WHEN/THEN; the poke-holes subagent finds gaps; the user keeps 3-5. Adds the DoD by type, technical context, an INVEST check and the proposed tasks. Second step of the create-story → refine-story → estimate-story flow.
argument-hint: <story-id>
disable-model-invocation: true
---

# Refine story

Second step of the flow **`/create-story` → `/refine-story` → `/estimate-story`**. It follows the
protocol of the course (04.3, *Anatomía de un backlog AI-ready*): **the human writes the happy path,
the AI looks for holes**. There is a reason for this split. Criteria drafted by an AI tend to be
plausible but generic. The person who owns the product knows which behaviour matters, and the AI is
good at spotting what that person took for granted. The story stays in Backlog and moves to `Todo`
when it is estimated.

Input: `$ARGUMENTS` = story ID.

## Language

Instructions here are in English, but **talk to the user in Spanish and write all Linear content in
Spanish**, using the PRD glossary (§8).

## Steps

1. **Load context.**
   - The story and its epic (`get_issue`).
   - `docs/instructions/workflow.md` §4-§5.
   - In `docs/PRD.md`: the H#/S#, its E#, §6 (assumptions and constraints), §7 (open questions) and
     §8 (glossary).

2. **Happy path (the user writes it).** Ask the user to write the happy-path scenario in
   GIVEN/WHEN/THEN. Do not offer a draft, not even as a starting point: a draft anchors the user and
   the scenario stops being theirs. Once you have it, review it only against this checklist (course
   11.2) and point out what fails, without rewriting it:
   - one `When` per scenario;
   - domain language: glossary terms, no UI steps (clicks, buttons) and no technical details
     (endpoints, tables). The scenario must survive a redesign of the panel or the API;
   - an observable, verifiable `Then`;
   - if several cases share a structure, suggest a `Scenario Outline` with `Examples`.

3. **Poke-holes (subagent).** Launch the **`poke-holes`** subagent and give it only the story ID, the
   Como/quiero/para, the non-goals and the user's happy path. Do not pass this conversation. The value
   of the subagent is that it has not seen what was already decided, so it does not share the
   author's blind spots. It returns 10-15 candidates in four categories.

4. **Selection (the user decides).**
   - Show the candidates numbered and grouped, and let the user keep **3-5**. More than that usually
     means the story is too big or the criteria are testing implementation details.
   - Write only the kept ones in GWT, using the same checklist, and mark *(asumido)* anything without
     evidence. Ask the user to approve the wording.
   - If a discarded candidate is really a product question (a decision for the DJ), propose adding it
     to PRD §7 rather than answering it yourself.

5. **Definition of Done.** Read [`assets/dod.md`](assets/dod.md) and copy **verbatim** the block that
   matches the story's **Tipo** label. The block is already in Spanish because it goes straight into
   Linear. Copying it without paraphrasing keeps every story's DoD identical for the same type.

6. **Technical context.** Put it at the end of the description, because it is for the implementing
   agent, not for the product reading. Include:
   - the `readme.md` sections that apply (e.g. §2.1 architecture, §2.2 components, §3 data model);
   - the placeholder `OpenSpec change: openspec/changes/<id> (pendiente)`.

7. **INVEST check.** One line per criterion (Independent, Negotiable, Valuable, Estimable, Small,
   Testable) with ✅/⚠️/❌ and a reason. If it fails **two or more**, the story is not ready: propose
   how to split it into 2-3 stories and stop there. Refining a story that should be split wastes the
   user's time.

8. **Propose tasks.** Follow `workflow.md` §2: one task = **one PR** in **one area**. For each task,
   give an imperative title, one area label and 1-2 lines on what gets integrated. Leave out the
   step-by-step: the implementing agent writes it in the OpenSpec change's `tasks.md`, and repeating it
   here would create two sources of truth.

9. **Human gate.** Build the new description and show it with the task list. Keep the
   **Historia** and **Non-goals** sections written by `/create-story` as they are, and replace the
   *pendiente* placeholder with the sections in [`assets/refinement.md`](assets/refinement.md). Final
   order: Historia · Criterios de aceptación · Non-goals · Definition of Done · Contexto técnico.
   Wait for the user's approval.

10. **Save to Linear.**
    - `save_issue` with the story `id`: updated description, same state (Backlog).
    - Then create each approved task as a sub-issue of the story: `save_issue` without `id`,
      `parentId` = the story, one area label, Backlog, no estimate.
    - Close by pointing to `/estimate-story <id>`.
