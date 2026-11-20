// PR de prueba del triaje tras el relanzamiento (change pr-check-rerun, 2.6): el E2E falla solo en
// el primer intento, y `lint` falla siempre por la variable sin usar.
import { expect, test } from '@playwright/test';

const sinUsar = 1;

test('pasa a partir del segundo intento del run', () => {
  expect(process.env.GITHUB_RUN_ATTEMPT).not.toBe('1');
});
