import { describe, expect, it } from 'vitest';

import { LED_RESPONSE } from './led-response.ts';

describe('la respuesta del LED', () => {
  it('da la gamma 2,0 de la v1 para los 256 valores', () => {
    expect(LED_RESPONSE).toHaveLength(256);
    LED_RESPONSE.forEach((dutyCycle, value) => {
      expect(dutyCycle, `valor ${value}`).toBe(Math.round(255 * (value / 255) ** 2));
    });
  });

  it('apaga los valores por debajo de 12 y enciende el 12', () => {
    expect(LED_RESPONSE[11]).toBe(0);
    expect(LED_RESPONSE[12]).toBe(1);
  });

  it('deja el 0 y el 255 como están', () => {
    expect(LED_RESPONSE[0]).toBe(0);
    expect(LED_RESPONSE[255]).toBe(255);
  });
});
