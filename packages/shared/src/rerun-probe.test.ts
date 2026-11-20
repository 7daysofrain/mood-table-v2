// PR de prueba del relanzamiento (change pr-check-rerun, 1.7): falla solo en el primer intento.
import { expect, it } from 'vitest';

it('pasa a partir del segundo intento del run', () => {
  expect(process.env.GITHUB_RUN_ATTEMPT).not.toBe('1');
});
