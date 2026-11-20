// PR de prueba del triaje tras el relanzamiento (change pr-check-rerun, 2.6): falla siempre.
import { expect, it } from 'vitest';

it('falla en todos los intentos del run', () => {
  expect(process.env.GITHUB_RUN_ATTEMPT).toBe('nunca');
});
