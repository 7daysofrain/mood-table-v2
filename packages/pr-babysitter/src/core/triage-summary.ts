/**
 * El resumen del triaje (change pr-shadow-triage, decisión 7): qué se dice en la PR de cada
 * hallazgo del push, en español y con las palabras del glosario de PB. Como el aviso de dominio,
 * aquí solo se decide el texto; el adaptador lo publica.
 *
 * Sale a nombre del mantenedor, así que dice que es del PR Babysitter (BE4), y lleva una marca
 * oculta con el SHA del push para no publicarlo dos veces.
 */
import * as z from 'zod';

import type { Finding, TriageClass, Verdict } from './triage.ts';

/** El triaje de un push, tal como queda en el estado del hilo. */
export interface TriagedPush {
  sha: string;
  findings: { finding: Finding; verdict: Verdict }[];
}

const CLASS_NAMES: Record<TriageClass, string> = {
  valid: 'real',
  notApplicable: 'no aplica',
  needsJudgment: 'exige criterio',
};

/** El texto del resumen, con la marca del push al final. */
export function triageSummary(triage: TriagedPush, threshold: number): string {
  const rows = triage.findings.map(
    ({ finding, verdict }) =>
      `| ${cell(identity(finding))} | ${CLASS_NAMES[verdict.class]} | ${why(finding, verdict, threshold)} |`,
  );
  return [
    `**Triaje del PR Babysitter** (modo sombra: no actúa) · push \`${triage.sha.slice(0, 7)}\``,
    '',
    '| Hallazgo | Clase | Por qué |',
    '|---|---|---|',
    ...rows,
    '',
    summaryMark(triage.sha),
  ].join('\n');
}

/** El hallazgo por su identidad: quién y dónde, y su título; o el nombre de la comprobación. */
function identity(finding: Finding): string {
  if (finding.source === 'check') return `Comprobación \`${finding.name}\``;
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const where = finding.line === null ? file : `${file}:${finding.line}`;
  const who = finding.badge === null ? finding.reviewer : `${finding.badge} de ${finding.reviewer}`;
  return `${who} en \`${where}\` · ${finding.title}`;
}

/**
 * Por qué tiene esa clase (BE4): la probabilidad frente al umbral, o la regla que lo decide. En una
 * comprobación, termina con el origen de su contexto.
 */
function why(finding: Finding, verdict: Verdict, threshold: number): string {
  return reason(finding, verdict, threshold) + contextOrigin(finding);
}

const ORIGIN_NAMES = {
  annotations: 'anotaciones',
  log: 'log',
  appSummary: 'resumen de la app',
} as const;

/**
 * De dónde sale el contexto de una comprobación, y si se ha cortado (change pr-check-triage,
 * decisión 2): cuánto fiarse de su clase depende de lo que vio el modelo.
 */
function contextOrigin(finding: Finding): string {
  if (finding.source !== 'check' || finding.context.state !== 'available') return '';
  const { origin, truncated } = finding.context;
  return ` · contexto: ${ORIGIN_NAMES[origin]}${truncated ? ', cortado' : ''}`;
}

function reason(finding: Finding, verdict: Verdict, threshold: number): string {
  switch (verdict.reason) {
    case 'noContext':
      if (finding.source === 'reviewer') return 'no se ha podido leer el trozo de diff que comenta';
      return finding.context.state === 'notProvided'
        ? 'la comprobación no da contexto'
        : 'no se ha podido leer su contexto';
    case 'overBudget':
      return 'no cabe en el tope de gasto de la PR';
    case 'modelUnavailable':
      return 'el modelo de decisión no ha respondido';
    case 'highSeverity':
      return `p = ${decimal(verdict.probability)}: descartaría un hallazgo de severidad alta`;
    case 'probability': {
      const p = `p = ${decimal(verdict.probability)}`;
      if (verdict.class === 'valid') return `${p} ≥ ${decimal(threshold)}`;
      if (verdict.class === 'notApplicable') return `${p} ≤ ${decimal(1 - threshold)}`;
      return `${p}: no llega al umbral de ${decimal(threshold)}`;
    }
  }
}

/** Con dos decimales y coma, como se escribe en español. */
function decimal(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Un texto en una celda de la tabla: sin saltos de línea y con las barras escapadas. */
function cell(text: string): string {
  return text.replaceAll(/\r?\n/g, ' ').replaceAll('|', String.raw`\|`);
}

const MARK = /<!-- pr-babysitter:triage (.*?) -->/gs;

const markSchema = z.object({ sha: z.string().min(1) });

function summaryMark(sha: string): string {
  const mark = JSON.stringify({ sha } satisfies z.infer<typeof markSchema>);
  return `<!-- pr-babysitter:triage ${mark} -->`;
}

/** Los SHA de las marcas de resumen de un comentario; una que no se entiende no cuenta. */
export function summaryMarks(body: string): string[] {
  return [...body.matchAll(MARK)].flatMap((match) => {
    let json: unknown;
    try {
      json = JSON.parse(match[1] ?? '');
    } catch {
      return [];
    }
    const parsed = markSchema.safeParse(json);
    return parsed.success ? [parsed.data.sha] : [];
  });
}
