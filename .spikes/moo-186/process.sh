#!/usr/bin/env bash
# Procesa la cola de skill-map con N sesiones de Claude Code sin interfaz (claude -p) en paralelo.
# Cada sesión deja su resumen JSON (tokens, coste, duración) en .spikes/moo-186/runs/.
# Uso (desde la raíz del repo): .spikes/moo-186/process.sh [workers] [modelo]
set -u
WORKERS=${1:-4}
MODEL=${2:-claude-sonnet-5-5}
DIR=.spikes/moo-186
mkdir -p "$DIR/reports" "$DIR/runs"
PROMPT="Process the skill-map job queue in this repository with the sm-process-jobs skill in single-pass mode (once). \
The CLI is invoked as \`pnpm exec sm\` (there is no \`sm\` on PATH). The skill-map MCP tools are not available: use the CLI path, \
skip the MCP probe and do not print the setup tip. For each claimed job, write the JSON report with the Write tool to \
$PWD/$DIR/reports/<job-id>.json (absolute path), then record it with \
\`pnpm exec sm record --id <id> --nonce <nonce> --status completed --report $DIR/reports/<job-id>.json --model $MODEL\`. \
Run every sm command alone, exactly as written: never append `;`, `&&`, `||`, a pipe or `echo` to it, because the \
Bash permission only matches a bare `pnpm exec sm …` command; a non-zero exit shows up in the tool result. Other workers claim from the same queue in parallel; that is expected. Stop when \`pnpm exec sm jobs claim --json\` exits 1. \
Do not edit any other file."
date +%s > "$DIR/runs/start"
for i in $(seq 1 "$WORKERS"); do
  claude -p "$PROMPT" --model "$MODEL" --output-format json --max-turns 400 \
    --permission-mode dontAsk \
    --allowedTools "Bash(pnpm exec sm:*)" "Read" "Write(//$PWD/$DIR/reports/**)" "Edit(//$PWD/$DIR/reports/**)" \
    > "$DIR/runs/worker-$i.json" 2> "$DIR/runs/worker-$i.err" &
  sleep 5
done
wait
date +%s > "$DIR/runs/end"
pnpm exec sm jobs status
