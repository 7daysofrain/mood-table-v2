/**
 * Envío de los mandos al motor, por clave (decisión 7 del change strip-effect-switch, decisión 3
 * del change strip-effect-values y decisión 9 del change instrument-intensity): cada cambio del DJ
 * sale al momento por un `PUT`. Como mucho hay uno en camino por clave, con el último cambio
 * pendiente: dos `PUT` de la misma clave en paralelo podrían llegar al motor en otro orden, y debe
 * ganar lo último que hizo el DJ. El ritmo lo marca lo que tarda la petición, no un reloj, así que
 * vale también mientras se arrastra un control.
 *
 * La clave es la tira en las colas del efecto y de los valores, independientes, y una sola en la
 * de la intensidad, que es del instrumento. No avisa de
 * errores: el panel marca lo que el motor dice por el WebSocket, y un error se ve en el visor
 * (PRD Q8).
 */
import type { EffectId, SetEffectBody, SetIntensityBody, SetValuesBody } from '@moodtable/shared';

/** Lo que el envío usa de `fetch`: así los tests pueden darle uno falso. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok'>>;

/**
 * El cuerpo en JSON, con sus campos en orden: los mismos valores en otro orden son el mismo cambio.
 * Los cuerpos de las dos rutas son objetos planos.
 */
function canonical(body: unknown): string {
  if (typeof body !== 'object' || body === null) return JSON.stringify(body);
  const fields = Object.keys(body).sort((a, b) => a.localeCompare(b));
  return JSON.stringify(body, fields);
}

/** Se queda sin envíos la clave `key`; `applied` dice si el motor aplicó el último. */
export type QueueListener = (key: string, applied: boolean) => void;

/** Una clave con una petición en camino. */
interface InFlight<T> {
  /** El último cambio hecho mientras tanto. */
  pending: T | undefined;
}

export class RequestQueue<T> {
  private readonly urlOf: (key: string) => string;
  private readonly bodyOf: (value: T) => unknown;
  private readonly fetch: FetchLike;
  /** Las claves con una petición en camino. */
  private readonly inFlight = new Map<string, InFlight<T>>();
  private readonly listeners = new Set<QueueListener>();

  /**
   * `urlOf` da la ruta del `PUT` de cada clave y `bodyOf`, el cuerpo de la petición para un
   * cambio.
   */
  constructor(
    urlOf: (key: string) => string,
    bodyOf: (value: T) => unknown,
    fetch: FetchLike = (url, init) => globalThis.fetch(url, init),
  ) {
    this.urlOf = urlOf;
    this.bodyOf = bodyOf;
    this.fetch = fetch;
  }

  /** Pide al motor el cambio `value` para la clave `key`. */
  send(key: string, value: T): void {
    const queued = this.inFlight.get(key);
    if (queued) {
      queued.pending = value;
      return;
    }
    this.put(key, value);
  }

  /** Si la clave tiene un envío en camino o pendiente. */
  busy(key: string): boolean {
    return this.inFlight.has(key);
  }

  /** Avisa a `listener` cada vez que una clave se queda sin envíos. Devuelve cómo dejar de oír. */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private put(key: string, value: T): void {
    const queued: InFlight<T> = { pending: undefined };
    this.inFlight.set(key, queued);
    const body = this.bodyOf(value);
    void this.fetch(this.urlOf(key), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(({ ok }) => ok)
      .catch(() => false)
      .then((applied) => {
        const { pending } = queued;
        this.inFlight.delete(key);
        // Si el motor ya tiene ese cambio, no hace falta pedirlo otra vez; si falló, sí.
        const repeated = pending !== undefined && canonical(this.bodyOf(pending)) === canonical(body);
        if (pending !== undefined && (!applied || !repeated)) {
          this.put(key, pending);
          return;
        }
        for (const listener of this.listeners) listener(key, applied);
      });
  }
}

/** La ruta de un recurso de la tira `stripId`: `/api/strips/{stripId}/<resource>`. */
function stripUrl(resource: string): (stripId: string) => string {
  return (stripId) => `/api/strips/${encodeURIComponent(stripId)}/${resource}`;
}

/** La cola de los cambios de efecto: `PUT /api/strips/{stripId}/effect`, con la tira de clave. */
export function effectRequests(fetch?: FetchLike): RequestQueue<EffectId> {
  const bodyOf = (effect: EffectId): SetEffectBody => ({ effect });
  return new RequestQueue<EffectId>(stripUrl('effect'), bodyOf, fetch);
}

/** La cola de los cambios de valores: `PUT /api/strips/{stripId}/values`, con todos los valores. */
export function valueRequests(fetch?: FetchLike): RequestQueue<SetValuesBody> {
  return new RequestQueue<SetValuesBody>(stripUrl('values'), (values) => values, fetch);
}

/** La única clave de la cola de la intensidad: la intensidad es del instrumento, no de una tira. */
export const INTENSITY_KEY = 'intensity';

/** La cola de los cambios de intensidad: `PUT /api/intensity`, con una sola clave. */
export function intensityRequests(fetch?: FetchLike): RequestQueue<number> {
  const bodyOf = (intensity: number): SetIntensityBody => ({ intensity });
  return new RequestQueue<number>(() => '/api/intensity', bodyOf, fetch);
}
