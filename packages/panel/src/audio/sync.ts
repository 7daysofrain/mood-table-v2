/**
 * Sincronía del reproductor con el visor (decisiones 1, 4 y 5 del change panel-audio-playback). Es
 * pura: no toca el navegador ni lee relojes, así que se prueba con los instantes a mano.
 *
 * El panel hace sonar el punto del fichero que muestra el visor, no el punto por el que va el motor:
 * la luz y las posiciones llegan por la misma conexión, así que el retraso de la red se cancela. Cada
 * posición que llega dice dónde estaba el visor en ese instante; con la mediana de la última ventana
 * se estima dónde está en cualquier otro, sin seguir el temblor de la red. Todo en aritmética
 * circular: el fichero suena en bucle.
 */

/** El reloj de audio en un momento, como lo da el `AudioContext`. */
export interface AudioClock {
  /** `AudioContext.currentTime`, en segundos. */
  contextTime: number;
  /** `performance.now()` al leerlo, en milisegundos. */
  now: number;
  /** `outputLatency` + `baseLatency` del contexto, en segundos, si el navegador los da. */
  outputLatency?: number;
  /** `getOutputTimestamp()`, si el navegador lo da. */
  timestamp?: { contextTime: number; performanceTime: number };
}

export interface SyncOptions {
  /** La ventana de posiciones que entra en la mediana, en milisegundos. Por defecto, 1 s. */
  windowMs?: number;
}

export interface Sync {
  /** Una posición del fichero (s) que llegó del motor en `arrivedAt` (ms de `performance.now()`). */
  add(position: number, arrivedAt: number): void;
  /** El punto del fichero (s) que muestra el visor en `at` (ms), o `undefined` si no hay posiciones. */
  pointAt(at: number): number | undefined;
  /** Olvida las posiciones: al perder la conexión, el motor de después puede ir por otro sitio. */
  reset(): void;
}

/**
 * El error a partir del cual se salta al punto correcto (decisión 4): deja margen dentro de los 45 ms
 * de E2 para el pintado del visor (hasta 17 ms).
 */
export const JUMP_THRESHOLD = 0.02;

/** `value` en módulo `duration`, también si es negativo. */
function wrap(value: number, duration: number): number {
  return ((value % duration) + duration) % duration;
}

/**
 * `a − b` por el camino más corto en el círculo de un fichero de `duration` segundos: 93,7 s frente a
 * 0,1 s en uno de 93,8 s es −0,2 s, no 93,6 s. Sin esto, cada vuelta del bucle parecería un error.
 */
export function circularDifference(a: number, b: number, duration: number): number {
  const difference = wrap(a - b, duration);
  return difference > duration / 2 ? difference - duration : difference;
}

/**
 * El momento (ms de `performance.now()`) en que se oye lo que el contexto suena en `contextTime`
 * (decisión 5). Si el navegador da `getOutputTimestamp()`, lo dice él; si no, o si aún no ha empezado
 * a sonar, se suma al reloj el retraso de salida que declara (0 si no lo declara). El arranque y el
 * error usan siempre esta misma cuenta, así que un retraso mal declarado no hace saltar en bucle.
 */
export function audibleAt(clock: AudioClock, contextTime: number): number {
  const { timestamp } = clock;
  if (timestamp && timestamp.performanceTime > 0) {
    return timestamp.performanceTime + (contextTime - timestamp.contextTime) * 1000;
  }
  return clock.now + (contextTime - clock.contextTime + (clock.outputLatency ?? 0)) * 1000;
}

/** Si un error (s, el punto que suena menos el del visor) pide saltar al punto correcto. */
export function shouldJump(error: number): boolean {
  return Math.abs(error) > JUMP_THRESHOLD;
}

/** La mediana de unos números que no están vacíos. Los ordena. */
function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const upper = values[middle] ?? 0;
  return values.length % 2 === 1 ? upper : ((values[middle - 1] ?? 0) + upper) / 2;
}

export function createSync(duration: number, { windowMs = 1000 }: SyncOptions = {}): Sync {
  const positions: number[] = [];
  const arrivals: number[] = [];

  return {
    add(position, arrivedAt) {
      positions.push(position);
      arrivals.push(arrivedAt);
      while ((arrivals[0] ?? arrivedAt) < arrivedAt - windowMs) {
        positions.shift();
        arrivals.shift();
      }
    },

    pointAt(at) {
      const count = positions.length;
      if (count === 0) return undefined;
      // Cada posición, avanzada hasta `at`, es una estimación del punto del visor. Se comparan con la
      // última en el círculo, para que la vuelta del bucle no ponga la mediana en mitad del fichero.
      const estimate = (index: number) =>
        (positions[index] ?? 0) + (at - (arrivals[index] ?? at)) / 1000;
      const last = estimate(count - 1);
      const offsets = positions.map((_, index) =>
        circularDifference(estimate(index), last, duration),
      );
      return wrap(last + median(offsets), duration);
    },

    reset() {
      positions.length = 0;
      arrivals.length = 0;
    },
  };
}
