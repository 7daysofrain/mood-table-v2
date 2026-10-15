/**
 * Arranque del motor: monta el bucle con las tiras de la configuración y sus salidas y lo pone en
 * marcha con el temporizador. `main.ts` le pasa las piezas reales; los tests, una salida en
 * memoria.
 */
import type { Config, StripConfig } from '@moodtable/shared';

import { startTicker, type Ticker } from './adapters/ticker.ts';
import { createFrameLoop, type LightOutput } from './core/frame-loop.ts';

export interface EngineOptions {
  config: Config;
  /**
   * Las salidas de cada tira, con su posición en el fichero. Las decide la raíz de composición
   * (decisión 2).
   */
  createOutputs: (strip: StripConfig, index: number) => LightOutput[];
  /** Reloj monótono en milisegundos. Por defecto, `performance.now()`. */
  clock?: () => number;
}

export function startEngine({ config, createOutputs, clock }: EngineOptions): Ticker {
  const loop = createFrameLoop(
    config.strips.map((strip, index) => ({ config: strip, outputs: createOutputs(strip, index) })),
    config.fps,
  );
  return startTicker(
    config.fps,
    (now) => {
      loop.tick(now);
    },
    clock,
  );
}

/**
 * La línea de log del arranque: qué fichero ha cargado, cuántas tiras, a qué fps y dónde se abre el
 * panel.
 */
export function startupMessage(file: string, config: Config, panelUrl: string): string {
  const strips = config.strips.length === 1 ? '1 tira' : `${config.strips.length} tiras`;
  return `Mood Table: cargado ${file} · ${strips} a ${config.fps} fps · panel en ${panelUrl}`;
}
