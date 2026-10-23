---
name: refine-story
description: Refine a Mood Table user story that is in Backlog in Linear. The user describes the happy path and the AI translates it to GIVEN/WHEN/THEN; the poke-holes subagent finds gaps; the user keeps 3-5. Checks INVEST right after the happy path (and stops to propose a split if it fails) and again at the end; adds the DoD by type, technical context and the proposed tasks. Second step of the create-story → refine-story → estimate-story flow.
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
Spanish**, using the glossary of the epic's source document.

## Steps

1. **Load context.**
   - The story and its epic (`get_issue`).
   - `docs/instructions/workflow.md` §2 (task = PR), §3 (the table of source documents) and §5 (rules
     for agents).
   - The epic's source document: the prefix of the epic's title (`H1`, `PB`…) says which one, and the
     table says where each part lives. Read through it, never by a section number you remember: the
     story it comes from (H#/S#, or BH#), its expectations, assumptions and constraints, open
     questions and glossary.

2. **Happy path (the user writes it).** Ask the user to describe the happy path **in natural
   language**. Do not offer a draft, not even as a starting point: a draft anchors the user and the
   scenario stops being theirs. Keep their answer word for word, and later any correction they make
   to it: steps 3, 4 and 5 all need it.

3. **Quick INVEST (before anything else is built on the story).** With the Como/quiero/para, the
   non-goals and the user's description, give one line per criterion (Independent, Negotiable,
   Valuable, Estimable, Small, Testable) with ✅/⚠️/❌ and a reason. If it fails **two or more**, the
   story is not ready: propose how to split it into 2-3 stories, each with its own observable
   behaviour, citing the evidence in the user's description (e.g. several actions that will not fit
   in one `When`), and stop there. Do not translate the description, do not launch poke-holes and do
   not write anything to Linear. The reason it goes here and not only at the end: every later step
   (translation, poke-holes, the user's selection, DoD, tasks) is work the user reviews, and all of it
   is wasted on a story that gets split. If it passes, show it briefly and carry on; the full check
   comes back in step 9.

4. **Translation to GIVEN/WHEN/THEN.** The content is the user's; the format is yours. Translate the
   description **without adding behaviour**: anything you had to fill in is marked *(asumido)* or
   asked, never slipped in. Show the translation and wait for the user to validate it. Apply this
   checklist (course 11.2) to the translation, and if the description itself breaks a rule (e.g. two
   actions, a `Then` that cannot be observed), point it out instead of silently fixing it:
   - one `When` per scenario;
   - domain language: glossary terms, no UI steps (clicks, buttons) and no technical details
     (endpoints, tables). The scenario must survive a redesign of the panel or the API;
   - an observable, verifiable `Then`;
   - if several cases share a structure, suggest a `Scenario Outline` with `Examples`.

5. **Poke-holes (subagent).** Once the user has validated the translation, launch the
   **`poke-holes`** subagent and give it only the story ID, the Como/quiero/para, the non-goals and the
   happy path **in the user's own words**: their answer from step 2, plus any correction or
   clarification they wrote while validating the translation in step 4, so the subagent does not
   reopen gaps the user already closed. Never your GWT translation. Do not pass this conversation.
   The value of the subagent is that it has not seen what was already decided, so it does not share
   the author's blind spots. Your translation is already an
   interpretation, with its *(asumido)* gaps filled in your way; passing it would hand the subagent
   your blind spots too. It returns up to 8 candidate criteria and up to 3 out-of-criteria notes, each
   tagged with its destination.

6. **Selection (the user decides).**
   - Show the candidates numbered, and let the user keep **3-5** of the criteria. More than that
     usually means the story is too big or the criteria are testing implementation details.
   - Route the out-of-criteria notes to their destination once the user agrees: `dependencia` → a
     relation in Linear (`blockedBy`) or the technical context; `non-goal` → the Non-goals section;
     `spec` → the technical context, as a question for the OpenSpec change.
   - Write only the kept ones in GWT, using the same checklist, and mark *(asumido)* anything without
     evidence. Ask the user to approve the wording.
   - If a discarded candidate is really a question for the source document's user (a decision for the
     DJ, or for the maintainer in PB), propose adding it to that document's open questions rather than
     answering it yourself.

7. **Definition of Done.** Read [`assets/dod.md`](assets/dod.md) and copy **verbatim** the block that
   matches the story's **Tipo** label. The block is already in Spanish because it goes straight into
   Linear. Copying it without paraphrasing keeps every story's DoD identical for the same type.

8. **Technical context.** Put it at the end of the description, because it is for the implementing
   agent, not for the product reading. Include:
   - the `readme.md` sections that apply (e.g. §2.1 architecture, §2.2 components, §3 data model);
   - the placeholder `OpenSpec change: openspec/changes/<id> (pendiente)`.

9. **Full INVEST check.** Same format and rule as step 3, now with the criteria, the DoD and the
   technical context in hand: they can show what the description alone could not (e.g. the kept
   criteria do not fit in 1-2 days). If it fails **two or more**, propose how to split the story into
   2-3 stories and stop there.

10. **Propose tasks.** Follow `workflow.md` §2: one task = **one PR** in **one area**. For each task,
    give an imperative title, one area label and 1-2 lines on what gets integrated. Leave out the
    step-by-step: the implementing agent writes it in the OpenSpec change's `tasks.md`, and repeating it
    here would create two sources of truth.

11. **Human gate.** Build the new description and show it with the task list. Keep the
    **Historia** and **Non-goals** sections written by `/create-story` as they are, and replace the
    *pendiente* placeholder with the sections in [`assets/refinement.md`](assets/refinement.md). Final
    order: Historia · Criterios de aceptación · Non-goals · Definition of Done · Contexto técnico.
    Wait for the user's approval.

12. **Save to Linear.**
    - `save_issue` with the story `id`: updated description, same state (Backlog).
    - Then create each approved task as a sub-issue of the story: `save_issue` without `id`,
      `parentId` = the story, one area label, Backlog, no estimate.
    - Close by pointing to `/estimate-story <id>`.
