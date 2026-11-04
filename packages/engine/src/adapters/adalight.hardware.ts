/**
 * El puerto serie de verdad para la salida Adalight: lo abre con `serialport` y lo envuelve en el
 * enlace mínimo que usa `adalight.ts`, donde está todo lo demás, con tests. Es lo único que importa
 * `serialport`, y queda fuera de la cobertura, como `soundcard.hardware.ts` (decisión 1 del change
 * adalight-strip-output).
 *
 * - `lock: true` (el valor por defecto): un puerto que tiene abierto otro programa no se comparte.
 * - «Ha salido» es el final del `drain()` (`tcdrain`), no el del `write`, que termina cuando los
 *   bytes llegan al búfer del sistema operativo (decisión 2).
 * - `serialport` configura el puerto en crudo al abrirlo; tras arrancar la Pi viene con eco y
 *   XON/XOFF (`HARDWARE_SETUP.md`).
 * - Un `error` sin escuchar tiraría el proceso de Node: se escucha desde que se abre, antes de que
 *   la salida pida que se le avise (decisión 5).
 * - Al abrirlo, el Arduino Uno se reinicia y tarda 1-2 s en pintar; al cerrarlo, también (`hupcl`).
 *   No se espera nada: el sketch busca la cabecera en cada frame (decisión 9).
 */
import { SerialPort } from 'serialport';

import type { OpenSerialLink } from './adalight.ts';

export const openSerialLink: OpenSerialLink = (path, baudRate) =>
  new Promise((resolve, reject) => {
    const port = new SerialPort({ path, baudRate, lock: true, autoOpen: false });
    port.open((openError) => {
      if (openError) {
        reject(openError);
        return;
      }

      let onLost: ((reason: string) => void) | undefined;
      let lostReason: string | undefined;
      const lose = (reason: string): void => {
        lostReason ??= reason;
        onLost?.(lostReason);
      };
      port.on('error', (error: Error) => lose(error.message));
      // Con el cable suelto, `close` llega con un error `disconnected`.
      port.on('close', (error?: Error) => lose(error?.message ?? 'se ha cerrado'));

      resolve({
        write(bytes, onSent) {
          port.write(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
          port.drain((error) => onSent(error ?? undefined));
        },
        watchLoss(listener) {
          onLost = listener;
          if (lostReason !== undefined) listener(lostReason);
        },
      });
    });
  });
