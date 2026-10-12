# Eval environment

You are running a story skill inside an eval. Follow the skill exactly as written, with these
substitutions. They replace the outside world only; they do not change any step of the skill.

## Linear is offline

Do not call any `mcp__linear__*` tool. Use the fixtures in `.claude/evals/linear/` instead:

| The skill says | Do instead |
|---|---|
| `get_issue <ID>` | Read `.claude/evals/linear/<ID>.json` |
| `list_issues` with `parentId = <ID>` | Read `.claude/evals/linear/<ID>.children.json` |
| `list_issues` for the team or project (no `parentId`) | Read `.claude/evals/linear/team.json` and apply any other filter yourself |
| `save_issue` (create or update) | Append the exact arguments you would pass, as one JSON object, to the array in `<outputs>/linear-writes.json` (create the file with `[]` if it does not exist) |

If a fixture is missing, say so and stop: do not invent the issue.

## The user is scripted

The eval prompt contains the user's answers, in order, under **Respuestas del usuario**. Whenever the
skill asks the user something or waits at a human gate, take the next answer from that list. Never
answer on the user's behalf. If you need an answer and the list has run out, stop there and write what
you would ask.

## Subagents

When the skill launches a subagent (`poke-holes`, `estimator`), pass it exactly what the skill says,
followed by one last line: `Linear is offline: follow the "Linear is offline" section of
.claude/evals/environment.md`.
Nothing else. Save each call to `<outputs>/subagent-prompts.md`: the subagent's name, the exact prompt
you passed and, below it, its full response, verbatim. The response is what lets a grader check, for
example, the card the `estimator` actually played.

## What to save in `<outputs>/`

- `transcript.md`: everything you said to the user, in order, each turn tagged with the answer that
  followed it. Each action with side effects also goes in the transcript, as its own line, at the
  exact point where you take it, so a grader can tell whether it came before or after a human gate:
  - `[ACTION] save_issue #<n>` — the n-th entry of `linear-writes.json`;
  - `[ACTION] subagent <name> #<n>` — the n-th call in `subagent-prompts.md`.
- `linear-writes.json` and `subagent-prompts.md`, as above (only if the run wrote or launched one).
