// PR de prueba del relanzamiento (change pr-check-rerun, 1.7): falla siempre.
import { expect, it } from 'vitest';

it('falla en todos los intentos', () => {
  expect(process.env.GITHUB_RUN_ATTEMPT).toBe('nunca');
});
