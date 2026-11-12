---
name: capture
description: Capture a Mood Table need that comes up mid-work (a possible spike, bug, story or chore) into Linear's Triage state, in the background, so the user can keep working. Adds the evidence already in the conversation and hands it to a background subagent that follows references/capturer.md. The user classifies captures later, by hand, in Linear.
argument-hint: <texto>
disable-model-invocation: true
---

# Capture

Needs often appear while the user is working on something else. Shaping them on the spot (a story, a
spike) would pull the user out of their work. This skill separates **noting** from **shaping**: it
writes a capture into Linear's *Triage* state in the background, and the user classifies it later, by
hand, in Linear's Triage inbox (accept with a type label and an epic, mark as duplicate, or discard).
The capture then becomes the issue itself.

Input: `$ARGUMENTS` = the user's words. The user typing `/capture` is the request: do not ask for
confirmation, and do not ask questions to improve the capture. Any question here is the interruption
this skill exists to avoid.

## Language

Instructions here are in English, but **talk to the user in Spanish**. The capture is written in
Spanish by the subagent.

## Steps

1. **No text?** If `$ARGUMENTS` is empty, say how to use it (`/capture <qué has visto o qué hace
   falta>`) and stop.

2. **Gather the evidence.** From this conversation, pick only what backs the user's words and that
   the subagent could not know: links, `file:line`, PR and job IDs, commits, short log excerpts (a few
   lines, not whole logs), trace IDs. Add a line `De dónde sale: MOO-n` with the Linear issue or PR
   the session is working on, if the need came out of it. Copy, do not summarise, classify or give
   your opinion: the subagent suggests the type, and the user decides it. If the conversation holds
   nothing relevant, write `Sin evidencia`.

3. **Launch the capturer in the background**: a `general-purpose` subagent with model `haiku`. Its
   instructions are [`references/capturer.md`](references/capturer.md), so its prompt is exactly:

   ```
   Read .claude/skills/capture/references/capturer.md and follow it exactly.

   Palabras del usuario:
   <$ARGUMENTS, verbatim>

   Evidencia de la conversación:
   <the evidence from step 2, or «Sin evidencia»>
   ```

   It is not a named subagent in `.claude/agents/` on purpose: only this skill uses it, and a session
   in a worktree would not find a named subagent that only exists on the worktree's branch.

   Keep the user's words verbatim: the capture quotes them, and they are the one thing the user will
   rely on when classifying.

4. **Hand back control.** Tell the user in one line that the capture is on its way, and carry on with
   whatever the session was doing.

5. **When the subagent finishes**, report it in one line:
   - `status: created` → «Capturada MOO-n · <title>» with its link.
   - `status: failed` → the error and, below it, the full prompt you sent, so the capture is not lost
     and the user can retry or paste it into Linear.
