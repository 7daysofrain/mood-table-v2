import { describe, expect, it } from 'vitest';

import { decide } from './decision.ts';

// Que relanza sea cual sea el veredicto del primer triaje lo prueba el grafo, con cada respuesta
// (`graph.test.ts`): `decide()` aún no lo recibe, porque en `MOO-178` no cambia nada.
describe('qué se hace con el triaje (change pr-first-failure-triage, decisión 1)', () => {
  it('en el primer fallo, relanza', () => {
    expect(decide('firstFailure')).toEqual({ action: 'rerun', rule: 'firstFailure' });
  });

  it('en la ronda final, publica el resumen y avisa del estado final', () => {
    expect(decide('final')).toEqual({ action: 'publish', rule: 'finalState' });
  });
});
