// Resume out/results.jsonl: por fila y variante, la p media, su rango, la clase con el umbral y los
// tokens. `hacia` es la p hacia la etiqueta: p si es real, 1 - p si es relanzar (no aplica).
//
//   node .spikes/moo-120/summarize.ts
import { readFileSync } from 'node:fs';

const THRESHOLD = 0.8;
const PRICE = 0.24;
const here = new URL('.', import.meta.url).pathname;
const lines = readFileSync(`${here}out/results.jsonl`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l) as { row: string; label: string; variant: string; p: number; inputTokens: number });

const groups = new Map<string, typeof lines>();
for (const l of lines) {
  const k = `${l.row}|${l.variant}`;
  groups.set(k, [...(groups.get(k) ?? []), l]);
}
const cls = (p: number) => (p >= THRESHOLD ? 'real' : 1 - p >= THRESHOLD ? 'no aplica' : 'exige criterio');

console.log('| Fila | Etiqueta | Variante | n | p media | p mín–máx | Hacia la etiqueta | Clase | Tokens | $ por llamada |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [k, g] of groups) {
  const [row, variant] = k.split('|');
  const ps = g.map((x) => x.p);
  const mean = ps.reduce((a, b) => a + b, 0) / ps.length;
  const toward = g[0].label === 'real' ? mean : 1 - mean;
  const tok = Math.round(g.reduce((a, b) => a + (b.inputTokens ?? 0), 0) / g.length);
  console.log(
    `| ${row} | ${g[0].label} | ${variant} | ${g.length} | ${mean.toFixed(3)} | ${Math.min(...ps).toFixed(3)}–${Math.max(...ps).toFixed(3)} | ${toward.toFixed(3)} | ${cls(mean)} | ${tok} | ${((tok * PRICE) / 1e6).toFixed(4)} |`,
  );
}
