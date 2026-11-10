/**
 * Un motor propio para los E2E que tienen que pararlo o arrancarlo (reinicio, panel sin motor) o que
 * necesitan otra configuración (una fuente de audio). Se arranca como proceso, igual que lo arranca
 * el maker, con su propio fichero de configuración (`MOODTABLE_CONFIG`) y un puerto libre: los E2E
 * prueban el sistema desde fuera, sin importar código del motor (README §2.3).
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

const MAIN = fileURLToPath(new URL('../packages/engine/src/main.ts', import.meta.url));

export interface TestEngine {
  /** Dirección del panel que sirve este motor. */
  url: string;
  /** Arranca el motor (otra vez, si se paró) en el mismo puerto. */
  start(): Promise<void>;
  /** Para el motor y espera a que termine. */
  stop(): Promise<void>;
  /** Mata el motor con `SIGKILL`, sin dejarle cerrar nada, como un corte de luz, y espera. */
  kill(): Promise<void>;
}

/** Un puerto libre de la máquina: se abre un servidor en el puerto 0 y se cierra. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (typeof address !== 'object' || !address) throw new Error('Sin puerto libre');
  return address.port;
}

export interface TestEngineOptions {
  /** Ruta absoluta de un fichero de audio como fuente. Sin ella, el motor no tiene fuente de audio. */
  audioFile?: string;
  /** El efecto con el que arranca la tira. Por defecto, la respiración. */
  effect?: 'breathing' | 'energy';
  /** Varias tiras, una por efecto y en este orden, en lugar de la única de `effect`. */
  effects?: readonly ('breathing' | 'energy')[];
  /**
   * Guarda el estado del instrumento en SQLite, en la carpeta de resultados del test, en lugar de en
   * memoria: para los E2E que reinician el motor y esperan que vuelva como estaba.
   */
  persistState?: boolean;
}

/**
 * Prepara un motor con una tira virtual de 60 LEDs (o una por efecto de `effects`) en un puerto
 * libre, sin arrancarlo, con la fuente de audio y el efecto que pida el test. Su fichero de
 * configuración va en la carpeta de resultados del test, que Playwright vacía en cada ejecución. El
 * estado del instrumento va en memoria, salvo con `persistState`.
 */
export async function createTestEngine({
  audioFile,
  effect = 'breathing',
  effects = [effect],
  persistState = false,
}: TestEngineOptions = {}): Promise<TestEngine> {
  const port = await freePort();
  const config = test.info().outputPath('config.json');
  await writeFile(
    config,
    JSON.stringify({
      server: { host: '127.0.0.1', port },
      ...(audioFile ? { audioSource: { type: 'file', path: audioFile } } : {}),
      // En memoria, o en la carpeta del test: los E2E no escriben en `data/` ni se pisan entre
      // ejecuciones.
      instrumentState: persistState
        ? { type: 'sqlite', path: test.info().outputPath('instrument-state.db') }
        : { type: 'memory' },
      strips: effects.map((each, index) => ({
        id: index === 0 ? 'e2e' : `e2e-${index + 1}`,
        name: index === 0 ? 'Tira de los E2E' : `Tira ${index + 1} de los E2E`,
        output: { type: 'virtual' },
        ledCount: 60,
        effect: each,
      })),
    }),
  );

  let engine: ChildProcess | undefined;

  /** Manda `signal` al motor, si está vivo, y espera a que termine. */
  async function end(signal: NodeJS.Signals): Promise<void> {
    const child = engine;
    engine = undefined;
    if (!child || child.exitCode !== null) return;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill(signal);
    await exited;
  }

  return {
    url: `http://127.0.0.1:${port}`,

    async start() {
      const child = spawn(process.execPath, [MAIN], {
        env: { ...process.env, MOODTABLE_CONFIG: config },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      engine = child;
      // Arrancado cuando escribe su línea de log; si termina antes, el error dice por qué.
      await new Promise<void>((resolve, reject) => {
        let output = '';
        const collect = (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes('panel en')) resolve();
        };
        child.stdout?.on('data', collect);
        child.stderr?.on('data', collect);
        child.once('exit', (code) => {
          reject(new Error(`El motor terminó con código ${String(code)}: ${output}`));
        });
      });
    },

    stop: () => end('SIGTERM'),
    kill: () => end('SIGKILL'),
  };
}
