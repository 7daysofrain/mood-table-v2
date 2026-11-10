/**
 * El *worker thread* que escribe el estado del instrumento (D105): el bucle de frames no espera nunca
 * a la tarjeta SD. Solo conecta los mensajes del adaptador con `sqliteStore`, que se prueba en el hilo
 * del test (`sqlite-state-store.test.ts`), así que queda fuera de la cobertura.
 *
 * Por cada estado lo escribe en una transacción, mide lo que tarda y lo cuenta; con `close`, cierra el
 * fichero y termina, después de lo que tuviera en cola.
 */
import { parentPort, workerData } from 'node:worker_threads';

import {
  connectForWriting,
  sqliteStore,
  type WriteReport,
  type WriterMessage,
} from './sqlite-state-store.ts';

const port = parentPort;
if (!port) throw new Error('sqlite-writer.worker.ts solo corre como worker');

const { path } = workerData as { path: string };
const db = connectForWriting(path);
const store = sqliteStore(db, () => new Date());

port.on('message', (message: WriterMessage) => {
  if (message.type === 'close') {
    db.close();
    port.close();
    return;
  }
  const startedAt = performance.now();
  let report: WriteReport;
  try {
    store.save(message.state);
    report = { ok: true, tookMs: performance.now() - startedAt };
  } catch (error) {
    report = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  port.postMessage(report);
});
