/**
 * El guardador del estado del instrumento (design.md, decisiones 2 y 3 del change
 * instrument-state-restore; D103). Escucha los cambios del búfer de control, vengan del mando que
 * vengan, y guarda el estado entero 500 ms después del último (*debounce*): mientras el DJ arrastra
 * un control no escribe, y tras un corte como mucho se pierden esos 500 ms o un arrastre a medias.
 *
 * El guardado es síncrono y corre en el hilo del bucle. Si tarda más de 10 ms (más de medio frame a
 * 60 fps, con margen), lo dice en el log con lo que ha tardado, para que un tirón se vea si llega a
 * pasar. Si falla, también lo dice, y el motor sigue: el siguiente cambio vuelve a intentarlo.
 *
 * El temporizador y el reloj se inyectan, como los del bucle, para probarlo con un reloj falso.
 */
import type { InstrumentState, StateStore } from './state-store.ts';

/** 500 ms sin cambios: el DJ ha dejado de tocar (D103). */
const DEBOUNCE_MS = 500;

/** Un guardado más lento queda en el log (D103). */
const SLOW_SAVE_MS = 10;

/** Un temporizador de un disparo: `setTimeout` en el motor, uno falso en los tests. */
export interface SaverTimer {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface StateSaverOptions {
  /** El búfer de control: avisa de cada cambio de efecto o de valores y da la foto del estado. */
  control: { watch(listener: () => void): () => void; instrumentState(): InstrumentState };
  store: StateStore;
  timer: SaverTimer;
  /** En milisegundos, para medir cuánto tarda un guardado. */
  clock: () => number;
  log: (line: string) => void;
}

export interface StateSaver {
  /** Deja de escuchar. Lo pendiente no se guarda (guardar al apagar es un non-goal del change). */
  stop(): void;
}

export function startStateSaver({
  control,
  store,
  timer,
  clock,
  log,
}: StateSaverOptions): StateSaver {
  let pending: unknown;
  let scheduled = false;

  function save(): void {
    scheduled = false;
    const startedAt = clock();
    try {
      store.save(control.instrumentState());
    } catch (error) {
      log(
        `No se ha podido guardar el estado del instrumento (${error instanceof Error ? error.message : String(error)}); ` +
          'se vuelve a intentar con el próximo cambio.',
      );
      return;
    }
    const took = clock() - startedAt;
    if (took > SLOW_SAVE_MS) {
      log(`El guardado del estado del instrumento ha tardado ${Math.round(took)} ms.`);
    }
  }

  const unwatch = control.watch(() => {
    // Cada cambio vuelve a empezar la cuenta.
    if (scheduled) timer.clear(pending);
    pending = timer.set(save, DEBOUNCE_MS);
    scheduled = true;
  });

  return {
    stop() {
      unwatch();
      if (scheduled) timer.clear(pending);
      scheduled = false;
    },
  };
}
