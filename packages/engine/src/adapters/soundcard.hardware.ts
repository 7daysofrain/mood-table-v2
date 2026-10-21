/**
 * El `arecord` de verdad para la fuente *tarjeta de sonido*: lanza el proceso y nada más. Todo lo
 * demás está en `soundcard.ts`, con tests; esto queda fuera de la cobertura, como el puerto serie.
 *
 * No se mata `arecord` al parar el motor: con Ctrl+C la señal llega a todo el grupo de procesos, y
 * systemd para todo el *cgroup* del servicio (design.md del change soundcard-audio-source).
 */
import { spawn } from 'node:child_process';

import type { CaptureExit, SpawnCapture } from './soundcard.ts';

export const spawnCapture: SpawnCapture = (command, args) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    onData: (listener) => child.stdout.on('data', listener),
    onStderr: (listener) => child.stderr.on('data', listener),
    onExit(listener) {
      // Si no se puede lanzar, Node avisa con `error` y puede que también con `close`: solo cuenta uno.
      let exited = false;
      const once = (exit: CaptureExit) => {
        if (exited) return;
        exited = true;
        listener(exit);
      };
      child.on('error', (error) => once({ code: null, error }));
      child.on('close', (code, signal) => once({ code, signal }));
    },
    stop: () => child.kill(),
  };
};
