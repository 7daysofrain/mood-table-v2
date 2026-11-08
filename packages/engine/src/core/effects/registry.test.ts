import { EFFECT_CATALOG } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { createAudioAnalyzer } from '../audio/analysis.ts';
import { defaultParams, type FrameContext } from './effect.ts';
import { type AnyEffect, EFFECTS } from './registry.ts';

const RATE = 44_100;
const FPS = 60;
/** Impar, para que los efectos en espejo también pinten el LED del centro. */
const LED_COUNT = 11;
const PULSES = 30;
/** La basura con que se llena `out` antes de cada pulso. */
const GARBAGE = 0xab;

/**
 * Los frames de `effect` en `PULSES` pulsos, con `out` lleno de `fill` antes de cada uno. Con audio,
 * un tono de 440 Hz que entra en todas las bandas por la ventana; sin él, `audio: null`.
 */
function framesOver(effect: AnyEffect, fill: number, withAudio: boolean): number[][] {
  const strip = {
    id: 'demo',
    name: 'Tira de prueba',
    output: { type: 'virtual' as const },
    ledCount: LED_COUNT,
    effect: 'breathing' as const,
  };
  const analyzer = createAudioAnalyzer(RATE);
  const memory = effect.createMemory(strip);
  const params = defaultParams(effect);
  const out = new Uint8Array(LED_COUNT * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / FPS, audio: null };
  const frames: number[][] = [];
  for (let pulse = 1; pulse <= PULSES; pulse++) {
    ctx.time = pulse / FPS;
    if (withAudio) {
      const start = ctx.time * RATE - analyzer.window.length;
      for (let index = 0; index < analyzer.window.length; index++) {
        analyzer.window[index] = Math.sin((2 * Math.PI * 440 * (start + index)) / RATE);
      }
      ctx.audio = analyzer.update(ctx.dt);
    }
    out.fill(fill);
    effect.render(ctx, params, memory, out);
    frames.push(Array.from(out));
  }
  return frames;
}

describe('el registro de efectos del motor', () => {
  it('tiene los mismos efectos que el catálogo de shared, con el mismo usesAudio', () => {
    const registered = EFFECTS.map(({ id, usesAudio, paramsSchema }) => ({
      id,
      usesAudio,
      paramsSchema,
    }));

    expect(registered).toEqual(EFFECT_CATALOG);
  });

  it.each(EFFECT_CATALOG.map((effect) => [effect.id, effect] as const))(
    '%s valida con el esquema de parámetros del catálogo, no con una copia',
    (id, { paramsSchema }) => {
      expect(EFFECTS.find((effect) => effect.id === id)?.paramsSchema).toBe(paramsSchema);
    },
  );

  // El contrato de `Effect`: el bucle escala `out` en su sitio con la intensidad (decisión 2 del
  // change instrument-intensity), así que un efecto que lo lea pintaría según la intensidad anterior.
  describe.each(EFFECTS.map((effect) => [effect.id, effect] as const))(
    '%s escribe todo el frame sin leer lo que había',
    (_id, effect) => {
      it.each([
        ['con audio', true],
        ['sin audio', false],
      ])('%s', (_label, withAudio) => {
        expect(framesOver(effect, GARBAGE, withAudio)).toEqual(framesOver(effect, 0, withAudio));
      });
    },
  );
});
