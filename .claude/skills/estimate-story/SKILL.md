---
name: estimate-story
description: Estimate a refined Mood Table story in Linear with blind planning poker between the user and the estimator subagent (Fibonacci 1-8), then move it to Todo. Third step of the create-story → refine-story → estimate-story flow.
argument-hint: <story-id>
disable-model-invocation: true
---

# Estimate story

Third step of the flow **`/create-story` → `/refine-story` → `/estimate-story`**. It is a separate
procedure on purpose. The course (04.2, 04.4) recommends estimating apart from the writing, and doing
it like **planning poker**: everyone estimates privately, the cards are revealed at the same time,
and the result is **not averaged**. In a one-person project the "team" is the user plus a subagent
that never saw the story being written.

Input: `$ARGUMENTS` = story ID.

## Language

Instructions here are in English, but **talk to the user in Spanish and write all Linear content in
Spanish**.

## Steps

1. **Precondition.** Read the story with `get_issue`. It must be refined: GWT criteria, non-goals and
   a DoD. If it is not, stop and point to `/refine-story`. An estimate of an unrefined story measures
   uncertainty, not effort.

2. **The user's card first.** Ask the user for their estimate (1, 2, 3, 5 or 8) and a one-line reason.
   Before that, give no hints at all: no opinion, no size, no comparisons. The most common failure
   (04.4) is accepting the AI's number when you have no strong opinion of your own, and the only
   defence is committing to a number first.

3. **The subagent's card.** Launch the **`estimator`** subagent and pass it only the story ID. It reads
   the story and its tasks by itself. Do not pass the AI t-shirt size or the user's card: either one
   would anchor it.

4. **Reveal.** Show both cards side by side, each with its reason.
   - If they match, that is the estimate.
   - If they differ, summarise which assumption each one is making, because that difference is the
     useful output of planning poker.

   The user decides the final number. Do not average and do not break the tie yourself: the user is
   accountable for the estimate.

5. **Size rules** (`linear.md` §4). A story is at most **5**. An **8** is not an estimate but a
   signal to split: send the story back to `/refine-story`.

6. **Human gate and save.** With the user's approval, call `save_issue` with the `id`:
   - `estimate` = the final number;
   - `state` = **Todo**;
   - append this line at the end of the description:
     `**Estimación:** <n> · humano <x> / IA <y> · <fecha> · <motivo si hubo discrepancia>`

   This record builds the history the estimator uses to calibrate future stories (04.4).
