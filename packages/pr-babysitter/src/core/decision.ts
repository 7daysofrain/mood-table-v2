/**
 * Qué se hace con el triaje (change pr-first-failure-triage, decisión 1; D122): el triaje dice qué
 * pasa con cada hallazgo, y `decide()` elige la acción por reglas, sin el modelo de decisión. El nodo
 * `decidir` del grafo guarda la decisión, con su regla, en el estado del hilo, y LangSmith la deja en
 * la traza (BE4).
 *
 * Hoy hay dos rondas y una acción por ronda: en el primer fallo de una relanzable, relanzar; antes
 * del aviso final, publicar el resumen y avisar. `MOO-179` añade no relanzar lo que causa la PR, y
 * aquí se enchufarán arreglar (BH3) y escalar (BH4).
 */
import * as z from 'zod';

import type { TriageRoundKind } from './triage.ts';

/**
 * La decisión: la acción y la regla que la toma. `rerun` relanza los *jobs* fallidos del run;
 * `publish` publica el resumen del triaje y avisa del estado final.
 */
export const decisionSchema = z.object({
  action: z.enum(['rerun', 'publish']),
  rule: z.enum(['firstFailure', 'finalState']),
});

export type Decision = z.infer<typeof decisionSchema>;

/**
 * La acción tras el triaje de una ronda. En el primer fallo se relanza siempre, sea cual sea el
 * veredicto (decisión 6: lo que no se sabe se relanza). `MOO-179` le pasa lo que respondió el primer
 * triaje de cada relanzable del push, para dejar de relanzar lo que es *real*.
 */
export function decide(round: TriageRoundKind): Decision {
  if (round === 'firstFailure') return { action: 'rerun', rule: 'firstFailure' };
  return { action: 'publish', rule: 'finalState' };
}
