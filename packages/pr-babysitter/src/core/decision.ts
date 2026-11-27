/**
 * Qué se hace con el triaje (change pr-first-failure-triage, decisión 1; D122): el triaje dice qué
 * pasa con cada hallazgo, y `decide()` elige la acción por reglas, sin el modelo de decisión. El nodo
 * `decidir` del grafo guarda la decisión, con su regla, en el estado del hilo, y LangSmith la deja en
 * la traza (BE4).
 *
 * Hay dos rondas: en el primer fallo de una relanzable, relanzar o, si la PR lo causa, no relanzar;
 * antes del aviso final, arreglar los hallazgos reales (change pr-fixer, decisión 11) o publicar el
 * resumen y avisar. Aquí se enchufará escalar (BH4).
 */
import * as z from 'zod';

import type { Finding, FirstTriage, TriageRoundKind, Verdict } from './triage.ts';

/**
 * La decisión: la acción y la regla que la toma. `rerun` relanza los *jobs* fallidos del run;
 * `skipRerun` no los relanza, porque la PR causa el fallo (`prCausesFailure`); `fix` pide arreglar
 * los hallazgos reales (`fixable`); `publish` publica el resumen del triaje y avisa del estado final,
 * con la regla de por qué no se arregla: no hay nada real (`finalState`), el arreglo está apagado
 * (`fixDisabled`), los reales son relanzables que la PR no causa (`notCausedByPr`) o no queda tope
 * (`fixBudgetSpent`).
 */
export const decisionSchema = z.object({
  action: z.enum(['rerun', 'skipRerun', 'fix', 'publish']),
  rule: z.enum([
    'firstFailure',
    'prCausesFailure',
    'finalState',
    'fixable',
    'fixDisabled',
    'notCausedByPr',
    'fixBudgetSpent',
  ]),
});

export type Decision = z.infer<typeof decisionSchema>;

/** Un hallazgo del triaje final con su veredicto. */
export interface TriagedFinding {
  finding: Finding;
  verdict: Verdict;
}

/** Lo que la ronda final necesita para decidir si arregla (change pr-fixer, decisión 11). */
export interface FixContext {
  /** El triaje final del push. */
  findings: TriagedFinding[];
  /** Si el arreglo está encendido (`FIX_ENABLED`, la vuelta atrás). */
  enabled: boolean;
  /** Si queda tope de gasto para arreglar en la PR (decisión 8). */
  budgetLeft: boolean;
}

/**
 * Si el sistema arregla el hallazgo: es real y no es una relanzable que ha fallado dos veces. Esa se
 * relanzó porque el triaje no dio que la causara la PR, así que no la causa o no está claro: se
 * avisa sin arreglar (decisión 11).
 */
export function isFixable({ verdict }: TriagedFinding): boolean {
  return verdict.class === 'valid' && verdict.reason !== 'failedTwice';
}

function decideFinal(fix: FixContext | undefined): Decision {
  const real = fix?.findings.filter(({ verdict }) => verdict.class === 'valid') ?? [];
  if (!fix || real.length === 0) return { action: 'publish', rule: 'finalState' };
  if (!fix.enabled) return { action: 'publish', rule: 'fixDisabled' };
  if (!real.some(isFixable)) return { action: 'publish', rule: 'notCausedByPr' };
  if (!fix.budgetLeft) return { action: 'publish', rule: 'fixBudgetSpent' };
  return { action: 'fix', rule: 'fixable' };
}

/**
 * La acción tras el triaje de una ronda. En el primer fallo, si alguna relanzable del push sale real
 * en su primer triaje (`firstTriage`), no se relanza ninguna: GitHub relanza juntos los *jobs*
 * fallidos del run (decisión 5). Lo demás se relanza, porque lo que no se sabe se relanza (decisión
 * 6): no aplica, exige criterio, el caso evidente o sin respuesta. En la ronda final, `fix` decide si
 * se arregla.
 */
export function decide(round: TriageRoundKind, firstTriage: FirstTriage = [], fix?: FixContext): Decision {
  if (round === 'final') return decideFinal(fix);
  if (firstTriage.some(({ verdict }) => verdict.class === 'valid')) {
    return { action: 'skipRerun', rule: 'prCausesFailure' };
  }
  return { action: 'rerun', rule: 'firstFailure' };
}
