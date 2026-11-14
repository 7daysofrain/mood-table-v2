/**
 * El contexto de una comprobación que falla (change pr-check-triage, decisiones 1 y 2; D114): qué
 * se le da al modelo de decisión, según la app que la ejecuta (`app.slug`) y no según su nombre.
 *
 * | App | Contexto | Origen |
 * |---|---|---|
 * | `github-actions` | Las anotaciones útiles del *check run*, todas | `annotations` |
 * | `github-actions`, sin anotaciones útiles | El paso que falla del log, entero | `log` |
 * | Cualquier otra | El título y el resumen que publica el *check run* | `appSummary` |
 *
 * El contexto se corta a 16 KiB *(asumido)*, sea cual sea su origen, y entonces lo dice. Es un
 * módulo del adaptador de los hallazgos y no un puerto: hoy solo lo usa el triaje.
 */
import type { CheckContext } from '../core/triage.ts';
import type { CheckAnnotation, CheckRun } from './github.ts';

/** Las lecturas de GitHub que hacen falta. Lanzan si GitHub falla y se puede reintentar. */
export interface CheckContextGitHub {
  checkRun(sha: string, checkName: string): Promise<CheckRun | null>;
  annotations(checkRunId: number): Promise<CheckAnnotation[] | null>;
  jobLog(jobId: number): Promise<string | null>;
}

/** El tamaño máximo del contexto de una comprobación que llega al modelo *(asumido)*. */
const MAX_CONTEXT_BYTES = 16 * 1024;

type CheckError = Extract<CheckContext, { state: 'available' }>['errors'][number];

/** Cómo acabó una comprobación en un push y su contexto. */
export async function readCheckContext(
  github: CheckContextGitHub,
  sha: string,
  checkName: string,
): Promise<{ conclusion: string | null; context: CheckContext }> {
  const run = await github.checkRun(sha, checkName);
  if (run === null) return { conclusion: null, context: { state: 'unreadable' } };
  const context = run.app === 'github-actions' ? await fromActions(github, run) : fromApp(run);
  return { conclusion: run.conclusion, context };
}

/** De GitHub Actions: las anotaciones útiles y, si no hay ninguna, el paso que falla del log. */
async function fromActions(github: CheckContextGitHub, run: CheckRun): Promise<CheckContext> {
  const annotations = await github.annotations(run.id);
  if (annotations === null) return { state: 'unreadable' };
  const useful = annotations.filter(isUseful);
  if (useful.length > 0) return fromAnnotations(useful);
  // El log solo se pide si no hay anotaciones útiles.
  const log = await github.jobLog(run.id);
  if (log === null) return { state: 'unreadable' };
  return text('log', failingStep(log));
}

/** De otra app: el título y el resumen que publica. */
function fromApp(run: CheckRun): CheckContext {
  const parts = [run.output.title, run.output.summary].map((part) => part?.trim() ?? '');
  return text('appSummary', parts.filter((part) => part !== '').join('\n\n'));
}

/**
 * Todas son útiles salvo las dos que deja cualquier *job* que falla: el `failure` de `.github`
 * («Process completed with exit code 1.») y un `notice` sin título (los avisos del *runner*).
 */
function isUseful(annotation: CheckAnnotation): boolean {
  if (annotation.level === 'failure' && annotation.path === '.github') return false;
  return !(annotation.level === 'notice' && annotation.title === null);
}

/**
 * Las anotaciones entran enteras y en orden mientras caben. Las informativas (el resumen de la
 * ejecución) van al resumen, y las demás son los errores. Si no cabe ni la primera, se corta su
 * mensaje por el final.
 */
function fromAnnotations(annotations: CheckAnnotation[]): CheckContext {
  const fitting: CheckAnnotation[] = [];
  let remaining = MAX_CONTEXT_BYTES;
  for (const annotation of annotations) {
    const size = bytes(annotation.title ?? '') + bytes(annotation.message);
    if (size > remaining) break;
    fitting.push(annotation);
    remaining -= size;
  }
  const [first] = annotations;
  if (fitting.length === 0 && first) {
    const room = MAX_CONTEXT_BYTES - bytes(first.title ?? '');
    fitting.push({ ...first, message: head(first.message, room) });
  }
  const notices = fitting.filter((annotation) => annotation.level === 'notice');
  const errors = fitting
    .filter((annotation) => annotation.level !== 'notice')
    .map(
      (annotation): CheckError => ({
        file: annotation.path,
        line: annotation.line,
        title: annotation.title,
        message: annotation.message,
      }),
    );
  return {
    state: 'available',
    origin: 'annotations',
    summary: notices.map(({ title, message }) => `${title ?? ''}\n${message}`.trim()).join('\n\n'),
    errors,
    truncated: fitting.length < annotations.length || fitting[0]?.message !== first?.message,
  };
}

/** Un contexto que es un texto: se corta por el principio, y vacío es que la comprobación no lo da. */
function text(origin: 'log' | 'appSummary', full: string): CheckContext {
  if (full === '') return { state: 'notProvided' };
  const summary = tail(full, MAX_CONTEXT_BYTES);
  return { state: 'available', origin, summary, errors: [], truncated: summary !== full };
}

const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
// eslint-disable-next-line no-control-regex -- los colores del log son secuencias de escape ANSI.
const ANSI_COLOR = /\u001b\[[\d;]*m/g;
const STEP_START = '##[group]Run ';
const JOB_CLEANUP = 'Post job cleanup.';

/**
 * El paso que falla de un log de GitHub Actions, entero, sin marcas de tiempo ni colores: desde el
 * `##[group]Run` del paso que contiene el primer `##[error]` hasta antes del paso siguiente o de la
 * limpieza del *job*. No se queda en el primer error: en Playwright es la primera línea del bloque
 * de error (`MOO-154`). Sin error marcado, el log entero, del que se manda el final.
 */
function failingStep(log: string): string {
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP, '').replaceAll(ANSI_COLOR, ''));
  const error = lines.findIndex((line) => line.startsWith('##[error]'));
  if (error === -1) return lines.join('\n').trim();
  const start = lines.slice(0, error).findLastIndex((line) => line.startsWith(STEP_START));
  const next = lines.findIndex(
    (line, i) => i > error && (line.startsWith(STEP_START) || line === JOB_CLEANUP),
  );
  return lines
    .slice(Math.max(0, start), next === -1 ? lines.length : next)
    .join('\n')
    .trim();
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** El final de un texto que cabe en `maxBytes`, desde el principio de una línea. */
function tail(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length <= maxBytes) return value;
  const cut = new TextDecoder().decode(encoded.slice(-maxBytes));
  // La primera línea puede ir cortada, incluso a mitad de un carácter.
  return cut.slice(cut.indexOf('\n') + 1);
}

/** El principio de un texto que cabe en `maxBytes`, sin un carácter cortado al final. */
function head(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length <= maxBytes) return value;
  return new TextDecoder().decode(encoded.slice(0, Math.max(0, maxBytes))).replace(/�+$/, '');
}
