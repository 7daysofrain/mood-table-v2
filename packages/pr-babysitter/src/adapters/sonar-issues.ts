/**
 * Las incidencias nuevas de SonarQube de la comprobación que las lista (change
 * pr-sonar-issue-triage, decisiones 4 y 5; D118): las saca de sus anotaciones, que `sonar-issues`
 * emite con este contrato (decisión 1), y les pone el código de alrededor de su línea en el commit
 * del push (D117).
 *
 * ```
 * ::error file=<ruta>,line=<línea>,title=<regla> · <severidad> · <nombre de la regla>::<mensaje>
 * ::notice title=Incidencias nuevas de SonarQube::<total> incidencias nuevas; se anotan <n>
 * ```
 *
 * Es un módulo del adaptador de los hallazgos, como `check-context.ts`: lee el contexto que ese
 * módulo ya ha armado con las anotaciones.
 */
import type { CheckContext } from '../core/triage.ts';

/** La lectura de GitHub que hace falta. Lanza si GitHub falla y se puede reintentar. */
export interface SonarIssuesGitHub {
  fileAt(sha: string, path: string): Promise<string | null>;
}

/** Una incidencia, tal como la anota `sonar-issues`, con su código. */
export interface SonarIssue {
  rule: string;
  ruleName: string;
  /** Alta es `BLOCKER` o `HIGH`: la que no se descarta sin criterio (PB §4.1). */
  severity: 'high' | 'normal';
  file: string;
  /** `null` si la incidencia es del fichero entero. */
  line: number | null;
  message: string;
  /** Las líneas de alrededor, numeradas; `null` si no se ha podido leer. */
  code: string | null;
}

/** Las líneas de antes y de después de la de la incidencia *(asumido)*, como en la prueba. */
const LINES_BEFORE = 25;
const LINES_AFTER = 15;
/** Las que se toman de una incidencia de fichero: las mismas que la ventana. */
const FILE_LINES = LINES_BEFORE + LINES_AFTER;

const SEPARATOR = ' · ';
const HIGH_SEVERITIES = new Set(['BLOCKER', 'HIGH']);
const TOTAL = /(\d+) incidencias nuevas; se anotan \d+/;

/**
 * Las incidencias de la comprobación y cuántas trae, o `null` si no anota ninguna legible: sin
 * anotaciones (el contexto es el log, o no hay), o con anotaciones que no son de incidencias. El
 * total sale del aviso; sin él, son las leídas.
 */
export async function readSonarIssues(
  github: SonarIssuesGitHub,
  sha: string,
  context: CheckContext,
): Promise<{ issues: SonarIssue[]; total: number } | null> {
  if (context.state !== 'available' || context.origin !== 'annotations') return null;
  const parsed = context.errors.flatMap((error) => {
    const issue = fromTitle(error.title);
    return issue ? [{ ...issue, file: error.file, line: error.line, message: error.message }] : [];
  });
  if (parsed.length === 0) return null;

  // Cada fichero, una vez por push, aunque tenga varias incidencias.
  const texts = new Map<string, Promise<string | null>>();
  const textOf = (path: string) => {
    let text = texts.get(path);
    if (!text) {
      text = github.fileAt(sha, path);
      texts.set(path, text);
    }
    return text;
  };
  const issues = await Promise.all(
    parsed.map(async (issue) => {
      const text = await textOf(issue.file);
      return { ...issue, code: text === null ? null : around(text, issue.line) };
    }),
  );
  const total = TOTAL.exec(context.summary)?.[1];
  return { issues, total: total === undefined ? issues.length : Number(total) };
}

/** La regla, su severidad y su nombre, del título; `null` si no es el de una incidencia. */
function fromTitle(
  title: string | null,
): Pick<SonarIssue, 'rule' | 'ruleName' | 'severity'> | null {
  const [rule, severity, ...name] = title?.split(SEPARATOR) ?? [];
  if (!rule || !severity || name.length === 0) return null;
  return {
    rule,
    ruleName: name.join(SEPARATOR),
    severity: HIGH_SEVERITIES.has(severity) ? 'high' : 'normal',
  };
}

/**
 * Las líneas de alrededor de la de la incidencia, numeradas y con `>>` en la suya: el formato que
 * se probó. Si es del fichero entero, las primeras, sin marca. `null` si la línea no está en el
 * fichero.
 */
function around(text: string, line: number | null): string | null {
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/);
  if (line !== null && (line < 1 || line > lines.length)) return null;
  const from = line === null ? 1 : Math.max(1, line - LINES_BEFORE);
  const to = Math.min(lines.length, line === null ? FILE_LINES : line + LINES_AFTER);
  return lines
    .slice(from - 1, to)
    .map((content, index) => {
      const number = from + index;
      return `${number === line ? '>>' : '  '} ${String(number).padStart(4)} | ${content}`;
    })
    .join('\n');
}
