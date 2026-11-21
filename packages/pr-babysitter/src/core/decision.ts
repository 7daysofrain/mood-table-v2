/**
 * Qué se hace con el triaje (change pr-first-failure-triage, decisión 1; D122): el triaje dice qué
 * pasa con cada hallazgo, y `decide()` elige la acción por reglas, sin el modelo de decisión. El nodo
 * `decidir` del grafo guarda la decisión, con su regla, en el estado del hilo, y LangSmith la deja en
 * la traza (BE4).
 *
 * Hoy hay dos rondas: en el primer fallo de una relanzable, relanzar o, si la PR lo causa, no
 * relanzar; antes del aviso final, publicar el resumen y avisar. Aquí se enchufarán arreglar (BH3) y
 * escalar (BH4).
 */
import * as z from 'zod';

import type { FirstTriage, TriageRoundKind } from './triage.ts';

/**
 * La decisión: la acción y la regla que la toma. `rerun` relanza los *jobs* fallidos del run;
 * `skipRerun` no los relanza, porque la PR causa el fallo (`prCausesFailure`); `publish` publica el
 * resumen del triaje y avisa del estado final.
 */
export const decisionSchema = z.object({
  action: z.enum(['rerun', 'skipRerun', 'publish']),
  rule: z.enum(['firstFailure', 'prCausesFailure', 'finalState']),
});

export type Decision = z.infer<typeof decisionSchema>;

/**
 * La acción tras el triaje de una ronda. En el primer fallo, si alguna relanzable del push sale real
 * en su primer triaje (`firstTriage`), no se relanza ninguna: GitHub relanza juntos los *jobs*
 * fallidos del run (decisión 5). Lo demás se relanza, porque lo que no se sabe se relanza (decisión
 * 6): no aplica, exige criterio, el caso evidente o sin respuesta.
 */
export function decide(round: TriageRoundKind, firstTriage: FirstTriage = []): Decision {
  if (round === 'final') return { action: 'publish', rule: 'finalState' };
  if (firstTriage.some(({ verdict }) => verdict.class === 'valid')) {
    return { action: 'skipRerun', rule: 'prCausesFailure' };
  }
  return { action: 'rerun', rule: 'firstFailure' };
}
