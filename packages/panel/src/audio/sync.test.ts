import { describe, expect, it } from 'vitest';

import {
  type AudioClock,
  audibleAt,
  circularDifference,
  createSync,
  JUMP_THRESHOLD,
  shouldJump,
} from './sync.ts';

/** Los 93,8 s de `bouncer.wav`. */
const BOUNCER = 93.8;
const FRAME_MS = 1000 / 60;

/** Un reloj de audio sin `getOutputTimestamp`: el contexto va por `contextTime` en `now`. */
function clock(contextTime: number, now: number, latency?: number): AudioClock {
  return { contextTime, now, outputLatency: latency };
}

describe('la diferencia circular entre dos puntos del fichero', () => {
  it('es la más corta en el círculo: 93,7 s frente a 0,1 s es −0,2 s, y al revés +0,2 s', () => {
    expect(circularDifference(93.7, 0.1, BOUNCER)).toBeCloseTo(-0.2, 9);
    expect(circularDifference(0.1, 93.7, BOUNCER)).toBeCloseTo(0.2, 9);
  });

  it('lejos del final, es la resta de siempre', () => {
    expect(circularDifference(10.03, 10, BOUNCER)).toBeCloseTo(0.03, 9);
  });
});

describe('cuándo se oye un instante del reloj de audio', () => {
  it('sin getOutputTimestamp, al cabo del retraso de salida que declara el navegador', () => {
    // El contexto va por 5 s en el instante 1000 ms; lo de 5,1 s se oye 100 ms después, más 30 ms.
    expect(audibleAt(clock(5, 1000, 0.03), 5.1)).toBeCloseTo(1130, 9);
  });

  it('sin retraso declarado, se toma 0', () => {
    expect(audibleAt(clock(5, 1000), 5.1)).toBeCloseTo(1100, 9);
  });

  it('con getOutputTimestamp, lo que dice: qué instante del contexto suena en qué momento', () => {
    const withTimestamp: AudioClock = {
      contextTime: 5,
      now: 1000,
      outputLatency: 0.5,
      timestamp: { contextTime: 4.96, performanceTime: 998 },
    };

    // 5,1 s está 140 ms por delante de lo que sonaba en 998 ms; no se suma el outputLatency.
    expect(audibleAt(withTimestamp, 5.1)).toBeCloseTo(1138, 9);
  });

  it('un getOutputTimestamp aún a cero (el contexto no ha empezado a sonar) no cuenta', () => {
    const notYet: AudioClock = {
      contextTime: 5,
      now: 1000,
      outputLatency: 0.03,
      timestamp: { contextTime: 0, performanceTime: 0 },
    };

    expect(audibleAt(notYet, 5.1)).toBeCloseTo(1130, 9);
  });
});

describe('el punto del visor, filtrado', () => {
  /** Posiciones de un motor a 60 fps desde `from`, llegadas sin retraso desde el instante `t0`. */
  function feed(sync: ReturnType<typeof createSync>, from: number, t0: number, count: number) {
    for (let index = 0; index < count; index++) {
      sync.add(from + index / 60, t0 + index * FRAME_MS);
    }
  }

  it('sin posiciones, no se sabe', () => {
    expect(createSync(BOUNCER).pointAt(1000)).toBeUndefined();
  });

  it('es el punto de la última posición, avanzado hasta el instante que se pide', () => {
    const sync = createSync(BOUNCER);
    feed(sync, 10, 1000, 60);

    // La última, 10 + 59/60 s, llegó en 1000 + 59 × 16,7 ms; 100 ms después, el visor va 0,1 s más.
    expect(sync.pointAt(1000 + 59 * FRAME_MS + 100)).toBeCloseTo(10 + 59 / 60 + 0.1, 6);
  });

  it('unas pocas llegadas retrasadas por jitter no mueven la referencia', () => {
    const steady = createSync(BOUNCER);
    const jittery = createSync(BOUNCER);
    for (let index = 0; index < 60; index++) {
      const position = 20 + index / 60;
      const arrivedAt = 1000 + index * FRAME_MS;
      steady.add(position, arrivedAt);
      // Una de cada diez llega 30 ms tarde.
      jittery.add(position, arrivedAt + (index % 10 === 3 ? 30 : 0));
    }
    const at = 1000 + 60 * FRAME_MS;

    expect(jittery.pointAt(at)).toBeCloseTo(steady.pointAt(at) ?? Number.NaN, 4);
  });

  it('solo cuenta la última ventana: tras un salto del motor, la referencia lo sigue', () => {
    const sync = createSync(BOUNCER, { windowMs: 1000 });
    feed(sync, 10, 1000, 120);
    // El motor se reinicia y vuelve a 0 s: un segundo después, la referencia ya es la nueva.
    feed(sync, 0, 1000 + 120 * FRAME_MS, 60);

    expect(sync.pointAt(1000 + 180 * FRAME_MS)).toBeCloseTo(1, 2);
  });

  it('en la vuelta del bucle, la mediana no se va a la mitad del fichero', () => {
    const sync = createSync(4);
    // Posiciones de 3,5 s a 4 s y de 0 s a 0,5 s, en 1 s de llegadas.
    for (let index = 0; index < 60; index++) {
      sync.add((3.5 + index / 60) % 4, 1000 + index * FRAME_MS);
    }

    expect(sync.pointAt(1000 + 60 * FRAME_MS)).toBeCloseTo(0.5, 4);
  });

  it('al olvidarlo todo, vuelve a no saberse', () => {
    const sync = createSync(BOUNCER);
    feed(sync, 10, 1000, 10);

    sync.reset();

    expect(sync.pointAt(1200)).toBeUndefined();
  });
});

describe('el punto de arranque', () => {
  it('es el punto del visor más el retraso de salida que declara el navegador', () => {
    const sync = createSync(BOUNCER);
    sync.add(30, 1000);

    // Si arranca ya, suena dentro de 40 ms: para entonces, el visor irá 40 ms más allá.
    const now = clock(7, 1000, 0.04);

    expect(sync.pointAt(audibleAt(now, now.contextTime))).toBeCloseTo(30.04, 9);
  });

  it('sin retraso declarado, es el punto del visor', () => {
    const sync = createSync(BOUNCER);
    sync.add(30, 1000);
    const now = clock(7, 1000);

    expect(sync.pointAt(audibleAt(now, now.contextTime))).toBeCloseTo(30, 9);
  });
});

describe('cuándo saltar', () => {
  it(`con un umbral de ${String(JUMP_THRESHOLD * 1000)} ms: a 19 ms no salta y a 21 ms sí`, () => {
    expect(shouldJump(0.019)).toBe(false);
    expect(shouldJump(-0.019)).toBe(false);
    expect(shouldJump(0.021)).toBe(true);
    expect(shouldJump(-0.021)).toBe(true);
  });
});
