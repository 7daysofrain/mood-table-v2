/**
 * Arranque del motor: monta el bucle con las tiras de la configuración y sus salidas y lo pone en
 * marcha con el temporizador. `main.ts` le pasa las piezas reales; los tests, una salida en
 * memoria.
 */
import { basename } from 'node:path';

import type { Config, SourceMessage, StripConfig } from '@moodtable/shared';

import { startTicker, type Ticker } from './adapters/ticker.ts';
import type { AudioSource } from './core/audio/audio-source.ts';
import {
  createFrameLoop,
  type LevelOutput,
  type LightOutput,
  type PositionOutput,
} from './core/frame-loop.ts';

export interface EngineOptions {
  config: Config;
  /**
   * Las salidas de cada tira, con su posición en el fichero. Las decide la raíz de composición
   * (decisión 2).
   */
  createOutputs: (strip: StripConfig, index: number) => LightOutput[];
  /** La fuente de audio, si el fichero declara una. */
  audioSource?: AudioSource;
  /** Quién recibe el nivel de la fuente en cada pulso. */
  levelOutputs?: LevelOutput[];
  /** Quién recibe la posición del fichero de audio en cada pulso. */
  positionOutputs?: PositionOutput[];
  /** Reloj monótono en milisegundos. Por defecto, `performance.now()`. */
  clock?: () => number;
}

export function startEngine({
  config,
  createOutputs,
  audioSource,
  levelOutputs,
  positionOutputs,
  clock,
}: EngineOptions): Ticker {
  const loop = createFrameLoop(
    config.strips.map((strip, index) => ({ config: strip, outputs: createOutputs(strip, index) })),
    config.fps,
    { audioSource, levelOutputs, positionOutputs },
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

/**
 * La fuente de audio tal como se anuncia a los paneles: si es un fichero, solo su nombre, nunca la
 * ruta, que en la demo pública es la del disco de la instancia (decisión 5 del change
 * virtual-strip-audio-file).
 */
export function sourceMessage(config: Config): SourceMessage {
  return config.audioSource?.type === 'file'
    ? { kind: 'file', name: basename(config.audioSource.path) }
    : { kind: 'none' };
}
