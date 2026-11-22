#!/usr/bin/env bash
# Encola las 5 revisiones con IA de skill-map sobre los nodos del spike MOO-186.
# Uso (desde la raíz del repo): .spikes/moo-186/submit.sh
set -u
FINDERS=${FINDERS:-"vagueness verbosity redundancy contradiction trigger"}
NODES="
.claude/skills/capture/SKILL.md
.claude/skills/capture/references/capturer.md
.claude/skills/close-spike/SKILL.md
.claude/skills/create-spike/SKILL.md
.claude/skills/create-story/SKILL.md
.claude/skills/refine-story/SKILL.md
.claude/skills/estimate-story/SKILL.md
.claude/agents/estimator.md
.claude/agents/poke-holes.md
AGENTS.md
docs/instructions/workflow.md
docs/instructions/linear.md
docs/instructions/course.md
docs/instructions/viewer-protocol.md
"
for n in $NODES; do
  for f in $FINDERS; do
    out=$(pnpm exec sm jobs submit "core/ai-$f-analyzer" -n "$n" -q 2>&1); rc=$?
    echo "$rc  $f  $n  ${out//$'\n'/ }"
  done
done
pnpm exec sm jobs status
