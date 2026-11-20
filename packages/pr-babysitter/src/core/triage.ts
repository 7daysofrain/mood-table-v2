/**
 * Las reglas del triaje en modo sombra (change pr-shadow-triage, decisiones 2, 4 y 6): qué es un
 * hallazgo, su clave, cuánto cabe en el tope de gasto de la PR y su clase. Funciones puras: el
 * modelo de decisión solo da una probabilidad por pregunta, y todo lo demás se decide aquí.
 *
 * Se valida con zod, porque el hallazgo y su veredicto van en el estado del grafo (D65).
 */
import * as z from 'zod';

/**
 * El contexto de una comprobación que falla (change pr-check-triage, decisión 1): lo que se le da
 * al modelo de decisión, de dónde sale y si se ha cortado. Sin él, separa la comprobación que no da
 * contexto (una app con el resumen vacío, un *job* sin anotaciones útiles y con el log vacío) de la
 * que GitHub no deja leer (el log ha caducado, se ha borrado o falta un permiso).
 */
export const checkContextSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('available'),
    /** De dónde sale: las anotaciones del *check run*, el log del *job* o el resumen de la app. */
    origin: z.enum(['annotations', 'log', 'appSummary']),
    /**
     * El texto: el paso que falla del log, el título y el resumen de la app o, con anotaciones, las
     * informativas (el resumen de la ejecución).
     */
    summary: z.string(),
    /** Cada error que señala una anotación; vacío con los otros orígenes. */
    errors: z.array(
      z.object({
        file: z.string(),
        line: z.number().int().nullable(),
        title: z.string().nullable(),
        message: z.string(),
      }),
    ),
    /** Si no cabía entero y se ha cortado. */
    truncated: z.boolean(),
  }),
  z.object({ state: z.literal('notProvided') }),
  z.object({ state: z.literal('unreadable') }),
]);

export type CheckContext = z.infer<typeof checkContextSchema>;

/**
 * Un hallazgo de la PR (glosario de PB): un comentario del revisor cuyo hilo sigue sin resolver, de
 * cualquier push (change pr-unresolved-threads, decisión 1); una comprobación que falla en el último
 * push, o una incidencia nueva de SonarQube que anota la comprobación que las lista (change
 * pr-sonar-issue-triage, decisión 5). El contexto de un comentario es el trozo de diff que comenta,
 * `null` si no se ha podido reunir; el de una comprobación, un `CheckContext`; el de una incidencia,
 * el código de alrededor de su línea, `null` si no se ha podido leer.
 */
export const findingSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('reviewer'),
    /** El nombre del revisor, para nombrar el hallazgo: `Codex`. */
    reviewer: z.string(),
    /** Su insignia de severidad, tal como la pone el revisor: `P1`. */
    badge: z.string().nullable(),
    /** La severidad en el idioma del sistema: alta es la que no se descarta sin criterio. */
    severity: z.enum(['high', 'normal']),
    file: z.string(),
    /** `null` si el comentario es del fichero entero. */
    line: z.number().int().nullable(),
    title: z.string(),
    text: z.string(),
    diffHunk: z.string().nullable(),
    /**
     * Si el comentario es de un push anterior, ese push (`null` si GitHub ya no da su commit, tras
     * un *force push*) y el código del último push alrededor de su línea, numerado y con `>>` en
     * ella, o `null` si no se ha podido leer (change pr-unresolved-threads, decisiones 1 y 3).
     * `null` si es del último push: su código es el que comentó.
     */
    earlierPush: z.object({ sha: z.string().nullable(), code: z.string().nullable() }).nullable(),
  }),
  z.object({
    source: z.literal('check'),
    name: z.string(),
    /** Cómo acabó: `failure`, `timed_out`, `cancelled`… `null` si GitHub no da su *check run*. */
    conclusion: z.string().nullable(),
    context: checkContextSchema,
  }),
  z.object({
    source: z.literal('sonarIssue'),
    /** La clave de la regla: `typescript:S3358`. */
    rule: z.string(),
    ruleName: z.string(),
    /** Alta es `BLOCKER` o `HIGH` en SonarQube: la que no se descarta sin criterio. */
    severity: z.enum(['high', 'normal']),
    file: z.string(),
    /** `null` si la incidencia es del fichero entero. */
    line: z.number().int().nullable(),
    message: z.string(),
    /** Las líneas de alrededor en el commit del push, numeradas. */
    code: z.string().nullable(),
  }),
]);

export type Finding = z.infer<typeof findingSchema>;

/**
 * Cuántas incidencias nuevas de SonarQube trae la comprobación que las lista y cuántas se trían
 * (change pr-sonar-issue-triage, decisión 5): se trían las que anota, como mucho 10. `null` si la
 * comprobación no falla o no anota ninguna legible.
 */
export const sonarIssueCountSchema = z
  .object({ total: z.number().int(), triaged: z.number().int() })
  .nullable();

export type SonarIssueCount = z.infer<typeof sonarIssueCountSchema>;

/**
 * Si el sistema tiene lo que señala el hallazgo: el trozo de diff que comenta el revisor, un
 * contexto de la comprobación que dar al modelo o el código de la incidencia. Sin él, no se
 * pregunta (regla 1).
 */
export function hasContext(finding: Finding): boolean {
  switch (finding.source) {
    case 'reviewer':
      return finding.diffHunk !== null;
    case 'check':
      return finding.context.state === 'available';
    case 'sonarIssue':
      return finding.code !== null;
  }
}

/** Lo común a todos los hallazgos de la PR: su título y su descripción (decisión 5). */
export interface PullRequestContext {
  title: string;
  description: string;
}

/** Las tres clases del triaje (glosario de PB): real, no aplica y exige criterio. */
export const triageClassSchema = z.enum(['valid', 'notApplicable', 'needsJudgment']);

export type TriageClass = z.infer<typeof triageClassSchema>;

/**
 * Por qué no se ha preguntado por un hallazgo, o no ha habido respuesta (reglas 1 a 3; la PR que
 * no dice su alcance: change pr-reviewer-scope, decisión 4; la comprobación de incidencias de
 * SonarQube que no anota ninguna legible: change pr-sonar-issue-triage, decisión 5; y el comentario
 * de un push anterior sin el código del último push: change pr-unresolved-threads, decisión 4).
 */
const unansweredSchema = z.enum([
  'noScope',
  'noIssues',
  'noContext',
  'noCurrentCode',
  'overBudget',
  'modelUnavailable',
]);

/**
 * La respuesta del modelo de decisión, según la pregunta: a la de la causa, la probabilidad del sí;
 * a la del alcance (change pr-reviewer-scope, decisiones 1 y 2), la de que el arreglo cae dentro del
 * alcance de la PR (P1, `inside`) y la de que es trabajo de otra tarea o historia (P2, `outside`); y
 * a la de un comentario de un push anterior, además, la de que el último push ya lo arregla
 * (`fixed`; change pr-unresolved-threads, decisión 3).
 */
export const modelAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('answered'), probability: z.number() }),
  z.object({ kind: z.literal('scope'), inside: z.number(), outside: z.number() }),
  z.object({
    kind: z.literal('fixedScope'),
    fixed: z.number(),
    inside: z.number(),
    outside: z.number(),
  }),
]);

export type ModelAnswer = z.infer<typeof modelAnswerSchema>;

/** Lo que se sabe de un hallazgo antes de clasificarlo: la respuesta del modelo, o por qué no la hay. */
export const triageAnswerSchema = z.union([
  z.object({ kind: unansweredSchema }),
  /** La decide la regla de las comprobaciones deterministas, sin preguntar. */
  z.object({ kind: z.literal('rule') }),
  modelAnswerSchema,
]);

export type TriageAnswer = z.infer<typeof triageAnswerSchema>;

/**
 * La respuesta sobre un hallazgo en un triaje del hilo (change pr-check-triage, decisión 4): de qué
 * ronda es, a qué hallazgo de esa ronda responde (su posición) y los tokens de entrada que costó.
 * La ronda es un número que crece con cada triaje del hilo.
 */
export const roundAnswerSchema = z.object({
  round: z.number().int(),
  index: z.number().int(),
  answer: triageAnswerSchema,
  inputTokens: z.number(),
});

export type RoundAnswer = z.infer<typeof roundAnswerSchema>;

/**
 * El reductor de las respuestas: junta las que llegan con las que había y se queda solo con las de
 * la ronda más alta. El hilo de una PR sobrevive entre pushes, y sin esto el triaje de un push
 * llevaría las respuestas del anterior, y el estado crecería push a push.
 */
export function latestRound(current: RoundAnswer[], incoming: RoundAnswer[]): RoundAnswer[] {
  const all = [...current, ...incoming];
  const latest = Math.max(...all.map(({ round }) => round));
  return all.filter(({ round }) => round === latest);
}

/**
 * La clase de un hallazgo y por qué (BE4): una de las reglas, la probabilidad de la causa frente al
 * umbral o las dos del alcance (change pr-reviewer-scope, decisión 1): solo llega P1 (`inScope`),
 * solo P2 (`outOfScope`), ninguna (`unclearScope`), las dos (`contradictoryScope`), o P2 en un
 * hallazgo de severidad alta (`highSeverity`). Una incidencia de SonarQube de severidad alta que
 * saldría *no aplica* también exige criterio por esa regla, con su única probabilidad (change
 * pr-sonar-issue-triage, decisión 5). Un comentario de un push anterior lleva además la
 * probabilidad de que el último push ya lo arregla (`fixed`), y es *no aplica* si llega
 * (`alreadyFixed`), o exige criterio por la regla de severidad alta (change pr-unresolved-threads,
 * decisión 4). Las probabilidades se guardan siempre, también cuando decide la regla de severidad
 * alta, para que `MOO-76` elija el corte sobre ellas.
 */
/** La clase por las dos probabilidades del alcance (change pr-reviewer-scope, decisión 1). */
const scopeVerdictSchema = z.object({
  class: triageClassSchema,
  reason: z.enum(['inScope', 'outOfScope', 'unclearScope', 'contradictoryScope', 'highSeverity']),
  inside: z.number(),
  outside: z.number(),
});

export const verdictSchema = z.union([
  z.object({ class: z.literal('needsJudgment'), reason: unansweredSchema }),
  z.object({ class: z.literal('valid'), reason: z.literal('rule') }),
  z.object({ class: triageClassSchema, reason: z.literal('probability'), probability: z.number() }),
  z.object({
    class: z.literal('needsJudgment'),
    reason: z.literal('highSeverity'),
    probability: z.number(),
  }),
  // Antes que la de dos probabilidades: zod quitaría `fixed` al aceptarla con esa.
  z.object({
    class: triageClassSchema,
    reason: z.enum([
      'alreadyFixed',
      'inScope',
      'outOfScope',
      'unclearScope',
      'contradictoryScope',
      'highSeverity',
    ]),
    fixed: z.number(),
    inside: z.number(),
    outside: z.number(),
  }),
  scopeVerdictSchema,
]);

export type Verdict = z.infer<typeof verdictSchema>;

/**
 * La clase de un hallazgo (decisión 4): si lo decide la regla de las comprobaciones deterministas,
 * real; sin respuesta del modelo, exige criterio con su motivo; con una sola probabilidad (la de la
 * causa, o la de que se cumple la regla de una incidencia), por ella (`byProbability`), y con la
 * del alcance, por las dos (`byScope`). Una incidencia de severidad alta que saldría no aplica exige
 * criterio, por esa regla.
 */
export function classify(finding: Finding, answer: TriageAnswer, threshold: number): Verdict {
  if (answer.kind === 'rule') return { class: 'valid', reason: 'rule' };
  if (answer.kind === 'scope') return byScope(finding, answer, threshold);
  if (answer.kind === 'fixedScope') return byFixedScope(finding, answer, threshold);
  if (answer.kind !== 'answered') return { class: 'needsJudgment', reason: answer.kind };
  const verdict = byProbability(answer.probability, threshold);
  if (
    verdict.class === 'notApplicable' &&
    finding.source === 'sonarIssue' &&
    finding.severity === 'high'
  ) {
    return { class: 'needsJudgment', reason: 'highSeverity', probability: answer.probability };
  }
  return verdict;
}

/**
 * Por la probabilidad del sí: real si llega al umbral, no aplica si no pasa de su complemento y
 * exige criterio entre los dos. El umbral es mayor que 0,5, así que los dos cortes no se cruzan (lo
 * valida la configuración).
 */
function byProbability(probability: number, threshold: number): Verdict {
  if (probability >= threshold) return { class: 'valid', reason: 'probability', probability };
  // `1 - p >= umbral` y no `p <= 1 - umbral`: con coma flotante, 1 - 0,80 no llega a 0,20.
  if (1 - probability >= threshold) {
    return { class: 'notApplicable', reason: 'probability', probability };
  }
  return { class: 'needsJudgment', reason: 'probability', probability };
}

/**
 * Por el alcance de la PR (change pr-reviewer-scope, decisión 1), con el umbral en las dos
 * preguntas: real si solo llega P1; no aplica si solo llega P2, salvo que sea de severidad alta,
 * que exige criterio por esa regla; y exige criterio si no llega ninguna o llegan las dos.
 */
function byScope(
  finding: Finding,
  { inside, outside }: Extract<ModelAnswer, { kind: 'scope' }>,
  threshold: number,
): z.infer<typeof scopeVerdictSchema> {
  const probabilities = { inside, outside };
  const isInside = inside >= threshold;
  const isOutside = outside >= threshold;
  if (isInside && isOutside) {
    return { class: 'needsJudgment', reason: 'contradictoryScope', ...probabilities };
  }
  if (isInside) return { class: 'valid', reason: 'inScope', ...probabilities };
  if (!isOutside) return { class: 'needsJudgment', reason: 'unclearScope', ...probabilities };
  if (finding.source === 'reviewer' && finding.severity === 'high') {
    return { class: 'needsJudgment', reason: 'highSeverity', ...probabilities };
  }
  return { class: 'notApplicable', reason: 'outOfScope', ...probabilities };
}

/**
 * Un comentario de un push anterior (change pr-unresolved-threads, decisión 4): no aplica si llega
 * que el último push ya lo arregla, salvo si es de severidad alta, que exige criterio por esa regla
 * (descartaría un hallazgo de severidad alta, PB §4.1); si no llega, por el alcance. Con las tres
 * probabilidades.
 */
function byFixedScope(
  finding: Finding,
  { fixed, inside, outside }: Extract<ModelAnswer, { kind: 'fixedScope' }>,
  threshold: number,
): Verdict {
  const probabilities = { fixed, inside, outside };
  if (fixed >= threshold) {
    if (finding.source === 'reviewer' && finding.severity === 'high') {
      return { class: 'needsJudgment', reason: 'highSeverity', ...probabilities };
    }
    return { class: 'notApplicable', reason: 'alreadyFixed', ...probabilities };
  }
  return { ...byScope(finding, { kind: 'scope', inside, outside }, threshold), fixed };
}

/** El tope de gasto de la PR y el precio del modelo, en dólares (decisión 6). */
export interface TriageBudget {
  capUsd: number;
  inputPricePerMTok: number;
}

/**
 * Qué hallazgos caben en lo que queda del tope de la PR (change pr-check-triage, decisión 5). La
 * salida es gratis, así que el coste es solo de entrada, y lo estima antes de llamar el modelo de
 * decisión (`estimate`), que sabe cómo es la petición de cada hallazgo. Entran por orden los que
 * caben junto con los que ya han entrado; los demás se quedan fuera (regla 2). Se reserva por lo
 * alto antes de preguntar, así que las peticiones en paralelo no pueden pasarse del tope.
 */
export function withinBudget(
  findings: Finding[],
  spentUsd: number,
  budget: TriageBudget,
  estimate: (finding: Finding) => number,
): { asked: Finding[]; overBudget: Finding[] } {
  let affordable = ((budget.capUsd - spentUsd) * 1_000_000) / budget.inputPricePerMTok;
  const asked: Finding[] = [];
  const overBudget: Finding[] = [];
  for (const finding of findings) {
    const tokens = estimate(finding);
    if (tokens <= affordable) {
      asked.push(finding);
      affordable -= tokens;
    } else {
      overBudget.push(finding);
    }
  }
  return { asked, overBudget };
}

/**
 * Lo que el triador decide de cada hallazgo sin el modelo de decisión (change pr-check-triage,
 * decisión 6; change pr-reviewer-scope, decisión 4; change pr-sonar-issue-triage, decisión 5), en
 * este orden: la regla, la comprobación de incidencias sin ninguna legible, el alcance de la PR, el
 * contexto y el tope. La respuesta de cada uno, en su posición, o `undefined` si hay que
 * preguntar al modelo.
 *
 * La regla va primero porque no necesita contexto ni gasta del tope: una comprobación de
 * `ruleChecks` (las deterministas: fallan solo si algo de la PR incumple su regla) sale real aunque
 * su log no se pueda leer o el tope esté agotado, y no reserva nada.
 *
 * La comprobación que lista las incidencias de SonarQube solo es un hallazgo si no anota ninguna
 * legible (si no, cada incidencia es el suyo): no hay nada que preguntar, y exige criterio sin
 * gastar del tope.
 *
 * Una PR con la descripción vacía o solo con espacios no dice su alcance, que es lo que se pregunta
 * por un comentario del revisor: sus comentarios exigen criterio sin preguntar ni reservar tope. Va
 * antes que el contexto porque es de la PR entera, y lo arregla el mantenedor una vez.
 *
 * Un comentario de un push anterior sin el código del último push alrededor de su línea tampoco se
 * pregunta, ni siquiera por el alcance: el modelo juzgaría con la misma seguridad sin ese contexto
 * (change pr-unresolved-threads, decisión 4). Va después del contexto y antes del tope.
 */
export function withoutModel(
  findings: Finding[],
  {
    ruleChecks,
    sonarIssuesCheck,
    description,
    spentUsd,
    budget,
    estimate,
  }: {
    /** Los nombres de las comprobaciones que decide la regla, tal como las exige la rama base. */
    ruleChecks: string[];
    /** El nombre de la comprobación que lista las incidencias nuevas de SonarQube. */
    sonarIssuesCheck: string;
    /** La descripción de la PR, que dice su alcance. */
    description: string;
    spentUsd: number;
    budget: TriageBudget;
    estimate: (finding: Finding) => number;
  },
): (TriageAnswer | undefined)[] {
  const byRule = (finding: Finding) =>
    finding.source === 'check' && ruleChecks.includes(finding.name);
  const withoutIssues = (finding: Finding) =>
    finding.source === 'check' && finding.name === sonarIssuesCheck;
  const withoutScope = (finding: Finding) =>
    finding.source === 'reviewer' && description.trim() === '';
  const withoutCurrentCode = (finding: Finding) =>
    finding.source === 'reviewer' && finding.earlierPush !== null && finding.earlierPush.code === null;
  const { overBudget } = withinBudget(
    findings.filter(
      (finding) =>
        !byRule(finding) &&
        !withoutIssues(finding) &&
        !withoutScope(finding) &&
        hasContext(finding) &&
        !withoutCurrentCode(finding),
    ),
    spentUsd,
    budget,
    estimate,
  );
  return findings.map((finding) => {
    if (byRule(finding)) return { kind: 'rule' };
    if (withoutIssues(finding)) return { kind: 'noIssues' };
    if (withoutScope(finding)) return { kind: 'noScope' };
    if (!hasContext(finding)) return { kind: 'noContext' };
    if (withoutCurrentCode(finding)) return { kind: 'noCurrentCode' };
    if (overBudget.includes(finding)) return { kind: 'overBudget' };
    return undefined;
  });
}

/**
 * Qué se le pregunta al modelo de decisión sobre un hallazgo (change pr-check-triage, decisión 3;
 * D114, D116, D118 y D120): por una comprobación que falla, si la causa esta PR; por un comentario
 * del revisor, si su arreglo cae dentro del alcance de la PR y si es trabajo de otra tarea, las dos
 * en una petición, y, si es de un push anterior, también si el último push ya lo arregla, las tres
 * en una petición (`fixedScope`); por una incidencia de SonarQube, si su regla se cumple en ese
 * código. Cómo se formula cada una es del adaptador.
 */
export const questionSchema = z.enum(['cause', 'scope', 'fixedScope', 'rule']);

export type Question = z.infer<typeof questionSchema>;

const QUESTIONS = { check: 'cause', reviewer: 'scope', sonarIssue: 'rule' } as const;

export function questionFor(finding: Finding): Question {
  if (finding.source === 'reviewer' && finding.earlierPush !== null) return 'fixedScope';
  return QUESTIONS[finding.source];
}

/** El gasto de la PR tras un triaje: lo que llevaba más los tokens de entrada cobrados. */
export function spend(spentUsd: number, inputTokens: number, budget: TriageBudget): number {
  return spentUsd + (inputTokens * budget.inputPricePerMTok) / 1_000_000;
}

/** Límite de Ollama para la clave de una pregunta (decisión 2). */
const MAX_KEY_LENGTH = 100;

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    // Ya no hay dos `_` seguidos: basta con quitar uno por cada punta.
    .replaceAll(/^_|_$/g, '');
}

function identity(finding: Finding): string {
  if (finding.source === 'check') return slug(`check ${finding.name}`);
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const parts =
    finding.source === 'reviewer'
      ? [finding.reviewer, finding.badge, file, finding.line]
      : ['sonar', finding.rule, file, finding.line];
  return slug(parts.filter((part) => part !== null).join(' '));
}

/**
 * La clave de cada hallazgo en la petición al modelo (decisiones 2 y 5): su identidad (fuente,
 * fichero y línea, con la regla en una incidencia, o el nombre de la comprobación), solo ASCII y como mucho 100 caracteres. Si dos
 * coinciden, la segunda lleva `_2`, y así.
 */
export function findingKeys(findings: Finding[]): string[] {
  const used = new Set<string>();
  return findings.map((finding) => {
    const base = identity(finding).slice(0, MAX_KEY_LENGTH);
    let key = base;
    let n = 1;
    while (used.has(key)) {
      n += 1;
      const suffix = `_${n}`;
      key = base.slice(0, MAX_KEY_LENGTH - suffix.length) + suffix;
    }
    used.add(key);
    return key;
  });
}
