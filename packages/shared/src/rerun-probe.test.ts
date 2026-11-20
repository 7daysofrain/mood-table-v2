// PR de prueba del triaje tras el relanzamiento (change pr-check-rerun, 2.6): falla solo en el
// primer intento.
import { expect, it } from 'vitest';

it('pasa a partir del segundo intento del run', () => {
  expect(process.env.GITHUB_RUN_ATTEMPT).not.toBe('1');
});
