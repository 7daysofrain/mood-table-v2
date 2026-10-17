#!/usr/bin/env bash
# Spike MOO-12 (tarea MOO-54): las 13 pasadas de bench.ts y el registro de si la Pi se frena.
# Desechable, como bench.ts. Para probarlo corto: SECONDS_PER_RUN=2 PAUSE_SECONDS=0 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

DURATION="${SECONDS_PER_RUN:-180}"
PAUSE="${PAUSE_SECONDS:-20}"
OUT=results
mkdir -p "$OUT"
: > "$OUT/results.jsonl"

# Condiciones de la prueba (criterio «el resultado se puede repetir»).
{
  echo "## fecha"; date '+%Y-%m-%dT%H:%M:%S%z'
  echo "## modelo"; cat /proc/device-tree/model 2>/dev/null || sysctl -n hw.model; echo
  echo "## memoria"; free -h 2>/dev/null || sysctl -n hw.memsize
  echo "## sistema"; cat /etc/os-release 2>/dev/null || sw_vers; uname -a
  echo "## node"; node -v
  echo "## fft.js"; node -p "require('./node_modules/fft.js/package.json').version"
  echo "## gobernador de la CPU"; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "n/a"
  echo "## commit"; git rev-parse HEAD
  echo "## procesos que más CPU gastan"; ps -eo pid,comm,%cpu,%mem --sort=-%cpu 2>/dev/null | head -15 || ps -Ao pid,comm,%cpu -r | head -15 || true # head corta y ps recibe SIGPIPE
} > "$OUT/conditions.txt"

# Una línea por segundo: get_throttled (los bits bajos dicen si está frenada AHORA), temperatura y
# frecuencia de la CPU. Fuera de la Pi no hay vcgencmd y solo apunta la hora.
monitor() {
  while true; do
    if command -v vcgencmd >/dev/null; then
      echo "$(date +%s) $(vcgencmd get_throttled) $(vcgencmd measure_temp) freq=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq)"
    else
      echo "$(date +%s) sin-vcgencmd"
    fi
    sleep 1
  done >> "$1"
}

run() { # $1 = nombre, $2 = tiras, $3 = fps
  local log="$OUT/$1.monitor.log"
  : > "$log"
  monitor "$log" &
  local mon=$!
  node bench.ts "$2" "$3" "$DURATION" | tee -a "$OUT/results.jsonl"
  kill "$mon"
  wait "$mon" 2>/dev/null || true
  sleep "$PAUSE"
}

for leds in 200 300 600; do
  for effect in spectrum energy; do
    for fps in 30 60; do
      run "$leds-$effect-$fps" "$leds:$effect" "$fps"
    done
  done
done
# La que decide, al final: con la Pi más caliente, que es lo conservador.
run "peor-300-spectrum-300-energy-60" "300:spectrum,300:energy" 60

echo "Terminado: $(wc -l < "$OUT/results.jsonl") pasadas en $OUT/"
