import { fileURLToPath } from 'node:url';

import { type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de las historias `MOO-94`, `MOO-99` y `MOO-98`: el DJ cambia el efecto de una tira desde el panel, con
 * la música sonando (specs/instrument-control). Cada test lanza su propio motor, con el fichero de
 * golpes y la tira con energía.
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

/** E1 (control → luz) de `docs/umbrales-para-specs.md`. */
const MAX_SWITCH_MS = 100;

/** Lo que el script de la página anota: cuándo pulsó el DJ y cuándo llegó cada frame de la tira. */
interface Timeline {
  pressedAt: number | undefined;
  /**
   * Instante de llegada de cada frame de la tira, si es de la respiración, hasta dónde llega su
   * luz, en LEDs desde el centro (0, solo los del centro; -1, apagada), y si algún canal brilla más
   * en un LED que en el de al lado más cerca del centro.
   */
  frames: [arrivedAt: number, breathing: boolean, reach: number, risesOutwards: boolean][];
}

declare global {
  interface Window {
    moodTableTimeline: Timeline;
  }
}

/**
 * Antes de cargar el panel: anota el instante del primer `pointerdown` y el de cada frame de la
 * tira 0 que llega por el WebSocket del visor (tipo `1`, `docs/instructions/viewer-protocol.md`).
 * Un frame es de la respiración si todos sus LEDs tienen el mismo color y no están apagados: la
 * respiración nunca baja del 5 %, y energía con este fichero es un dibujo en espejo o negro.
 *
 * Energía nunca sube hacia fuera: cada canal es una barra que nace en el centro, desenfocada. El
 * espectro, con los golpes, que son ruido, brilla más en los extremos (los agudos) que en el centro.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timeline: Timeline = { pressedAt: undefined, frames: [] };
    window.moodTableTimeline = timeline;
    document.addEventListener(
      'pointerdown',
      () => {
        timeline.pressedAt ??= performance.now();
      },
      { capture: true },
    );
    const HEADER_BYTES = 6;
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        super(...args);
        this.addEventListener('message', ({ data }: MessageEvent) => {
          if (!(data instanceof ArrayBuffer)) return;
          const bytes = new Uint8Array(data);
          if (bytes[0] !== 1 || bytes[5] !== 0) return;
          const [red = 0, green = 0, blue = 0] = bytes.subarray(HEADER_BYTES, HEADER_BYTES + 3);
          const center = ((bytes.length - HEADER_BYTES) / 3 - 1) / 2;
          let uniform = true;
          let reach = -1;
          let risesOutwards = false;
          for (let index = HEADER_BYTES; index < bytes.length; index += 3) {
            const [r = 0, g = 0, b = 0] = bytes.subarray(index, index + 3);
            if (r !== red || g !== green || b !== blue) uniform = false;
            const led = (index - HEADER_BYTES) / 3;
            const fromCenter = Math.floor(Math.abs(led - center));
            if (r + g + b > 0) reach = Math.max(reach, fromCenter);
            if (Math.abs(led - center) < 1) continue;
            const inner = HEADER_BYTES + (led < center ? led + 1 : led - 1) * 3;
            for (let channel = 0; channel < 3; channel++) {
              if ((bytes[index + channel] ?? 0) > (bytes[inner + channel] ?? 0)) risesOutwards = true;
            }
          }
          timeline.frames.push([
            performance.now(),
            uniform && red + green + blue > 0,
            reach,
            risesOutwards,
          ]);
        });
      }
    };
  });
}

function zone(page: Page, name: string) {
  return page.getByRole('region', { name });
}

function effect(page: Page, name: string) {
  return zone(page, 'Efectos').getByRole('button', { name: new RegExp(`^${name}`) });
}

test('el DJ cambia el efecto de la tira desde el panel', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);

    // El DJ ve su tira, seleccionada, con el efecto que pinta el motor marcado.
    const strip = zone(page, 'Tiras').getByRole('radio', { name: /Tira de los E2E/ });
    await expect(strip).toBeChecked();
    await expect(strip).toContainText('60 LEDs · Virtual');
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Respiración')).not.toHaveAttribute('aria-current');

    // E1 se mide en directo, con el panel ya usado en las pruebas de antes de la sesión (D98): el
    // DJ prueba otro efecto y vuelve. Siendo otro, lo que tarda el panel en pintar por primera vez
    // los controles de la respiración sigue dentro de la medida.
    await effect(page, 'Scroll').click();
    await expect(effect(page, 'Scroll')).toHaveAttribute('aria-current', 'true');
    await effect(page, 'Energía').click();
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    await page.evaluate(() => {
      Object.assign(window.moodTableTimeline, { pressedAt: undefined, frames: [] });
    });

    // Elige la respiración: la tira se pinta con ella en menos de 100 ms desde que la pulsa.
    await effect(page, 'Respiración').click();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
    // El motor avisa del efecto nuevo al recibir el cambio, y el frame llega en el pulso siguiente:
    // se espera a tenerlo antes de leer los tiempos. El que cuenta es el de su llegada, no este.
    const timeline = () => page.evaluate(() => window.moodTableTimeline);
    await expect
      .poll(
        async () => {
          const { pressedAt: pressed, frames: arrived } = await timeline();
          return (
            pressed !== undefined &&
            arrived.some(([arrivedAt, breathing]) => arrivedAt >= pressed && breathing)
          );
        },
        { message: 'la tira pinta la respiración' },
      )
      .toBe(true);
    const { pressedAt, frames } = await timeline();
    if (pressedAt === undefined) throw new Error('No se anotó la pulsación');
    expect(
      frames.some(([arrivedAt, breathing]) => arrivedAt < pressedAt && breathing),
      'antes de pulsar, la tira no pinta la respiración',
    ).toBe(false);
    const firstBreathing = frames.find(
      ([arrivedAt, breathing]) => arrivedAt >= pressedAt && breathing,
    );
    if (!firstBreathing) throw new Error('La tira no ha pintado la respiración');
    // El tiempo medido queda en el informe, para ver cuánto margen deja a los 100 ms.
    const switchMs = firstBreathing[0] - pressedAt;
    test.info().annotations.push({
      type: 'pulsar → respiración',
      description: `${switchMs.toFixed(1)} ms`,
    });
    expect(switchMs).toBeLessThan(MAX_SWITCH_MS);

    // Al recargar, el panel marca lo que pinta el motor, no lo que dice el fichero.
    await page.reload();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
  } finally {
    await engine.stop();
  }
});

test('el DJ elige el scroll para la tira', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    const timeline = () => page.evaluate(() => window.moodTableTimeline);
    // Antes de elegir, se espera a ver un golpe pintado por energía.
    await expect
      .poll(async () => (await timeline()).frames.some(([, , reach]) => reach > 0), {
        message: 'energía pinta un golpe',
      })
      .toBe(true);

    await effect(page, 'Scroll').click();

    // Queda marcado como el activo, reactivo, y la zona Controles solo tiene su título.
    await expect(effect(page, 'Scroll')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Scroll')).toContainText('Reactivo');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
    await expect(zone(page, 'Controles')).toHaveText(/^Controles$/);

    // La luz del scroll nace en el centro: su primer frame con luz solo enciende los LEDs del
    // centro, y energía, con su desenfoque de 4 LEDs, nunca lo hace. Después avanza un LED por frame.
    const bornAt = (frames: Timeline['frames'], pressed: number) =>
      frames.findIndex(([arrivedAt, , reach]) => arrivedAt >= pressed && reach === 0);
    // Se espera al frame en que nace y a unos cuantos más, para ver cómo avanza.
    const FRAMES_AFTER_BIRTH = 4;
    await expect
      .poll(
        async () => {
          const { pressedAt: pressed, frames } = await timeline();
          if (pressed === undefined) return false;
          const born = bornAt(frames, pressed);
          return born >= 0 && frames.length - born > FRAMES_AFTER_BIRTH;
        },
        { message: 'la luz del scroll nace en el centro', timeout: 5000 },
      )
      .toBe(true);
    const { pressedAt, frames } = await timeline();
    if (pressedAt === undefined) throw new Error('No se anotó la pulsación');
    expect(
      frames.some(([arrivedAt, , reach]) => arrivedAt < pressedAt && reach === 0),
      'energía nunca enciende solo el centro',
    ).toBe(false);
    const born = bornAt(frames, pressedAt);
    const run = frames.slice(born).map(([, , reach]) => reach);
    const lit = run.slice(0, run.indexOf(-1) === -1 ? run.length : run.indexOf(-1));
    expect(lit.length).toBeGreaterThan(1);
    expect(lit).toEqual(lit.map((_, step) => step));
  } finally {
    await engine.stop();
  }
});

test('el DJ elige el espectro para la tira', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    const timeline = () => page.evaluate(() => window.moodTableTimeline);
    // Antes de elegir, se espera a ver un golpe pintado por energía.
    await expect
      .poll(async () => (await timeline()).frames.some(([, , reach]) => reach > 0), {
        message: 'energía pinta un golpe',
      })
      .toBe(true);

    await effect(page, 'Espectro').click();

    // Queda marcado como el activo, reactivo, y la zona Controles solo tiene su título.
    await expect(effect(page, 'Espectro')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Espectro')).toContainText('Reactivo');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
    await expect(zone(page, 'Controles')).toHaveText(/^Controles$/);

    // Los frames dejan de ser los de energía: el primero del espectro con luz sube hacia los
    // extremos, y desde él ninguno con luz es como los de energía. Se espera a más de un golpe.
    const lit = (frames: Timeline['frames'], pressed: number) =>
      frames.filter(([arrivedAt, , reach]) => arrivedAt >= pressed && reach >= 0);
    await expect
      .poll(
        async () => {
          const { pressedAt: pressed, frames } = await timeline();
          if (pressed === undefined) return 0;
          const after = lit(frames, pressed);
          const first = after.findIndex(([, , , rises]) => rises);
          return first < 0 ? 0 : after.slice(first).length;
        },
        { message: 'el espectro pinta más de un golpe', timeout: 5000 },
      )
      .toBeGreaterThan(4);
    const { pressedAt, frames } = await timeline();
    if (pressedAt === undefined) throw new Error('No se anotó la pulsación');
    expect(
      frames.some(([arrivedAt, , reach, rises]) => arrivedAt < pressedAt && reach >= 0 && rises),
      'energía nunca sube hacia los extremos',
    ).toBe(false);
    const after = lit(frames, pressedAt);
    const first = after.findIndex(([, , , rises]) => rises);
    expect(after.slice(first).every(([, , , rises]) => rises)).toBe(true);
  } finally {
    await engine.stop();
  }
});
