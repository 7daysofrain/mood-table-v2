/**
 * El resumen del triaje (change pr-shadow-triage, decisión 7): qué se dice en la PR de cada
 * hallazgo del push, en español y con las palabras del glosario de PB. Como el aviso de dominio,
 * aquí solo se decide el texto; el adaptador lo publica.
 *
 * Sale a nombre del mantenedor, así que dice que es del PR Babysitter (BE4), y lleva una marca
 * oculta con el SHA del push para no publicarlo dos veces.
 */
import * as z from 'zod';

import type {
  EvidentCase,
  Finding,
  FirstTriage,
  SonarIssueCount,
  TriageClass,
  Verdict,
} from './triage.ts';

/** El triaje de un push, tal como queda en el estado del hilo. */
export interface TriagedPush {
  sha: string;
  findings: { finding: Finding; verdict: Verdict }[];
  /** Cuántas incidencias de SonarQube trae la comprobación que las lista y cuántas se han triado. */
  sonarIssues?: SonarIssueCount;
  /**
   * Las comprobaciones que el sistema relanzó en el push y han pasado (change pr-check-rerun,
   * decisión 8): no son hallazgos, pero el mantenedor ve que hubo un fallo transitorio.
   */
  rerunPassed?: string[];
  /**
   * Lo que respondió el triaje del primer fallo de cada relanzable (change pr-first-failure-triage,
   * decisión 8): el resumen lo dice de las que se relanzaron.
   */
  firstTriage?: FirstTriage;
}

const CLASS_NAMES: Record<TriageClass, string> = {
  valid: 'real',
  notApplicable: 'no aplica',
  needsJudgment: 'exige criterio',
};

/**
 * El texto del resumen, con la marca del push al final: la tabla de hallazgos, si hay alguno, y
 * debajo lo que se relanzó y pasó (change pr-check-rerun, decisión 8). De cada relanzable que se
 * relanzó, dice además qué respondió el triaje de su primer fallo (change pr-first-failure-triage,
 * decisión 8).
 *
 * La cabecera dice «no arregla», como el glosario de PB (*modo sombra*): el sistema ya relanza, y lo
 * decide con el triaje.
 */
export function triageSummary(triage: TriagedPush, threshold: number): string {
  const firstTriage = triage.firstTriage ?? [];
  const note = (name: string) => firstTriageNote(name, firstTriage, threshold);
  const rows = triage.findings.map(
    ({ finding, verdict }) =>
      `| ${cell(identity(finding))} | ${CLASS_NAMES[verdict.class]} | ${why(finding, verdict, threshold)}${rerunNote(finding, verdict, note)}${capturedNote(finding, verdict, firstTriage)} |`,
  );
  const table = rows.length === 0 ? [] : ['| Hallazgo | Clase | Por qué |', '|---|---|---|', ...rows, ''];
  return [
    `**Triaje del PR Babysitter** (modo sombra: no arregla) · push \`${triage.sha.slice(0, 7)}\``,
    '',
    ...table,
    ...cutList(triage.sonarIssues),
    ...rerunPassedLines(triage.rerunPassed ?? [], note),
    summaryMark(triage.sha),
  ].join('\n');
}

/** Una línea por comprobación relanzada que ha pasado, con la nota de su primer triaje. */
function rerunPassedLines(names: string[], note: (name: string) => string): string[] {
  if (names.length === 0) return [];
  return [...names.map((name) => `La comprobación \`${name}\` se relanzó y pasó${note(name)}.`), ''];
}

/**
 * La nota del primer triaje en la fila de una relanzable que se relanzó: la que ha fallado dos veces
 * o cuyo relanzamiento no ha terminado. Una que no se relanzó no la lleva.
 */
function rerunNote(finding: Finding, verdict: Verdict, note: (name: string) => string): string {
  if (finding.source !== 'check') return '';
  return verdict.reason === 'failedTwice' || verdict.reason === 'rerunUnfinished'
    ? note(finding.name)
    : '';
}

/**
 * En la fila de una relanzable que no se relanzó y sale con su primer triaje (change
 * pr-first-failure-triage, decisiones 4 y 5): si no la causa la PR, que se capturaría. Pasa cuando
 * la PR causa el fallo de otra del mismo run. Las filas de las relanzadas salen por una regla, nunca
 * por la probabilidad.
 */
function capturedNote(finding: Finding, verdict: Verdict, firstTriage: FirstTriage): string {
  const fromFirstTriage =
    finding.source === 'check' && firstTriage.some(({ name }) => name === finding.name);
  return fromFirstTriage && verdict.reason === 'probability' && verdict.class === 'notApplicable'
    ? ' · se capturaría'
    : '';
}

/**
 * Qué respondió el triaje del primer fallo de una relanzable (change pr-first-failure-triage,
 * decisión 8), o nada si no se trió. «Se capturaría» es una nota, no una clase (BQ8, D119).
 */
function firstTriageNote(name: string, firstTriage: FirstTriage, threshold: number): string {
  const verdict = firstTriage.find((entry) => entry.name === name)?.verdict;
  const answer = verdict ? firstAnswer(verdict, threshold) : null;
  return answer === null ? '' : ` · primer intento: ${answer}`;
}

/** Los motivos por los que no se ha preguntado por la causa del primer fallo. */
const UNASKED: Partial<Record<Verdict['reason'], string>> = {
  noContext: 'no se ha podido reunir su contexto',
  overBudget: 'no cabe en el tope de gasto de la PR',
  modelUnavailable: 'el modelo de decisión no ha respondido',
};

function firstAnswer(verdict: Verdict, threshold: number): string | null {
  if (verdict.reason === 'evident') return `caso evidente: ${EVIDENT_CASES[verdict.evidentCase]}`;
  if (verdict.reason === 'probability') {
    const p = `p = ${decimal(verdict.probability)}`;
    if (verdict.class === 'valid') return `${p} ≥ ${decimal(threshold)}`;
    if (verdict.class === 'notApplicable') return `${p} ≤ ${decimal(1 - threshold)} · se capturaría`;
    return `${p}, no llega al umbral`;
  }
  const unasked = UNASKED[verdict.reason];
  return unasked === undefined ? null : `no se ha podido preguntar por la causa: ${unasked}`;
}

/**
 * Si la comprobación de incidencias trae más de las que anota, y por tanto de las triadas (change
 * pr-sonar-issue-triage, decisión 5): las demás no salen en la tabla, y el resumen lo dice.
 */
function cutList(count: SonarIssueCount | undefined): string[] {
  if (!count || count.triaged >= count.total) return [];
  return [
    `La comprobación de incidencias nuevas de SonarQube trae ${count.total}; ` +
      `se han triado las ${count.triaged} que anota.`,
    '',
  ];
}

/**
 * El hallazgo por su identidad: quién y dónde, y su título, y si es de un push anterior, cuál
 * (change pr-unresolved-threads, decisión 5); el nombre de la comprobación; o la regla de la
 * incidencia y dónde, y el nombre de la regla.
 */
function identity(finding: Finding): string {
  if (finding.source === 'check') return `Comprobación \`${finding.name}\``;
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const where = finding.line === null ? file : `${file}:${finding.line}`;
  if (finding.source === 'sonarIssue') {
    return `SonarQube \`${finding.rule}\` en \`${where}\` · ${finding.ruleName}`;
  }
  const who = finding.badge === null ? finding.reviewer : `${finding.badge} de ${finding.reviewer}`;
  const push = finding.earlierPush === null ? '' : ` · de un push anterior${pushSha(finding.earlierPush.sha)}`;
  return `${who} en \`${where}\` · ${finding.title}${push}`;
}

/** El SHA corto del push de un comentario, si GitHub aún da su commit (change pr-unresolved-threads). */
function pushSha(sha: string | null): string {
  return sha === null ? '' : ` (\`${sha.slice(0, 7)}\`)`;
}

/**
 * Por qué tiene esa clase (BE4): la probabilidad frente al umbral, o la regla que lo decide, sin
 * probabilidad (change pr-reviewer-scope, decisión 3). En una comprobación, termina con el origen de
 * su contexto.
 */
function why(finding: Finding, verdict: Verdict, threshold: number): string {
  // La regla decide por el nombre de la comprobación: su contexto no ha contado.
  if (verdict.reason === 'rule') return 'regla: comprobación determinista';
  // Ni en una relanzable, que decide cómo acabó el relanzamiento (change pr-check-rerun, decisión
  // 1); el contexto solo da el caso evidente, que lo dice.
  if (verdict.reason === 'failedTwice') {
    const evident = verdict.evidentCase ? ` · caso evidente: ${EVIDENT_CASES[verdict.evidentCase]}` : '';
    return `regla: ha fallado dos veces${evident}`;
  }
  // Ni en la comprobación de incidencias que no anota ninguna legible, ni en una relanzable sin
  // resultado: no se ha preguntado por ellas.
  const origin = WITHOUT_ORIGIN.has(verdict.reason) ? '' : contextOrigin(finding);
  return reason(finding, verdict, threshold) + origin;
}

const WITHOUT_ORIGIN = new Set<Verdict['reason']>(['noIssues', 'notRerun', 'rerunUnfinished', 'cancelled']);

/** Cada caso evidente con las palabras del glosario de PB. */
const EVIDENT_CASES: Record<EvidentCase, string> = {
  timeout: 'timeout',
  infrastructure: 'infraestructura',
  network: 'red',
  runnerLost: 'runner perdido',
};

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

function reason(
  finding: Finding,
  verdict: Exclude<Verdict, { reason: 'rule' | 'failedTwice' }>,
  threshold: number,
): string {
  switch (verdict.reason) {
    // Solo en el triaje del primer fallo (change pr-first-failure-triage, decisión 3).
    case 'evident':
      return `caso evidente: ${EVIDENT_CASES[verdict.evidentCase]}`;
    case 'notRerun':
      return 'regla: no se ha podido relanzar';
    case 'rerunUnfinished':
      return 'regla: el relanzamiento no ha terminado';
    case 'cancelled':
      return 'regla: se ha cancelado';
    case 'noContext':
      if (finding.source === 'reviewer') return 'no se ha podido leer el trozo de diff que comenta';
      if (finding.source === 'sonarIssue') return 'no se ha podido leer su código';
      return finding.context.state === 'notProvided'
        ? 'la comprobación no da contexto'
        : 'no se ha podido leer su contexto';
    case 'noIssues':
      return 'no anota ninguna incidencia legible';
    case 'overBudget':
      return 'no cabe en el tope de gasto de la PR';
    case 'modelUnavailable':
      return 'el modelo de decisión no ha respondido';
    case 'noScope':
      return 'regla: la PR no dice su alcance';
    // Un comentario de un push anterior (change pr-unresolved-threads, decisión 5).
    case 'noCurrentCode':
      return 'no se ha podido leer su código en el último push';
    case 'alreadyFixed':
      return `ya arreglado en el último push: p = ${decimal(verdict.fixed)} ≥ ${decimal(threshold)}`;
    case 'highSeverity':
      return 'regla: descartaría un hallazgo de severidad alta';
    // Por el alcance de la PR: la pregunta que llega al umbral, o las dos si no llega una sola. El
    // modelo de decisión no redacta (D90): el porqué de «se capturaría» es P2 y su probabilidad, y
    // de qué trataría la captura ya está en la fila.
    case 'inScope':
      return `dentro del alcance: p = ${decimal(verdict.inside)} ≥ ${decimal(threshold)}`;
    case 'outOfScope':
      return `de otra tarea: p = ${decimal(verdict.outside)} ≥ ${decimal(threshold)} · se capturaría`;
    case 'unclearScope':
      return `${bothScopes(verdict)}: ninguna llega a ${decimal(threshold)}`;
    case 'contradictoryScope':
      return `${bothScopes(verdict)}: se contradicen`;
    case 'probability': {
      const p = `p = ${decimal(verdict.probability)}`;
      if (verdict.class === 'valid') return `${p} ≥ ${decimal(threshold)}`;
      if (verdict.class === 'notApplicable') {
        // Una incidencia que no aplica se aceptaría en SonarQube, con el motivo (BQ9).
        const accepted = finding.source === 'sonarIssue' ? ' · se aceptaría en SonarQube' : '';
        return `${p} ≤ ${decimal(1 - threshold)}${accepted}`;
      }
      return `${p}: no llega al umbral de ${decimal(threshold)}`;
    }
  }
}

/**
 * Las dos probabilidades del alcance, P1 y P2, para que se vea hacia qué lado iba, y, en un
 * comentario de un push anterior, delante, la de que ya está arreglado: todas las de su petición.
 */
function bothScopes({
  fixed,
  inside,
  outside,
}: {
  fixed?: number;
  inside: number;
  outside: number;
}): string {
  const scope = `dentro p = ${decimal(inside)}, de otra tarea p = ${decimal(outside)}`;
  return fixed === undefined ? scope : `ya arreglado p = ${decimal(fixed)}, ${scope}`;
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
