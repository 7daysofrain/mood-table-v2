/**
 * Envío de los mandos al motor, por tira (decisión 7 del change strip-effect-switch y decisión 3
 * del change strip-effect-values): cada cambio del DJ sale al momento por un `PUT` de la tira.
 * Como mucho hay uno en camino por tira, con el último cambio pendiente: dos `PUT` de la misma tira
 * en paralelo podrían llegar al motor en otro orden, y debe ganar lo último que hizo el DJ. El
 * ritmo lo marca lo que tarda la petición, no un reloj, así que vale también mientras se arrastra
 * un control.
 *
 * Hay una cola para el efecto y otra para los valores, independientes. No avisa de errores: el
 * panel marca lo que el motor dice por el WebSocket, y un error se ve en el visor (PRD Q8).
 */
import type { EffectId, SetEffectBody, SetValuesBody } from '@moodtable/shared';

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

/** Se queda sin envíos la tira `stripId`; `applied` dice si el motor aplicó el último. */
export type QueueListener = (stripId: string, applied: boolean) => void;

/** Una tira con una petición en camino. */
interface InFlight<T> {
  /** El último cambio hecho mientras tanto. */
  pending: T | undefined;
}

export class StripRequests<T> {
  private readonly resource: string;
  private readonly bodyOf: (value: T) => unknown;
  private readonly fetch: FetchLike;
  /** Las tiras con una petición en camino. */
  private readonly inFlight = new Map<string, InFlight<T>>();
  private readonly listeners = new Set<QueueListener>();

  /**
   * `resource` es el final de la ruta (`/api/strips/{stripId}/<resource>`) y `bodyOf`, el cuerpo de
   * la petición para un cambio.
   */
  constructor(
    resource: string,
    bodyOf: (value: T) => unknown,
    fetch: FetchLike = (url, init) => globalThis.fetch(url, init),
  ) {
    this.resource = resource;
    this.bodyOf = bodyOf;
    this.fetch = fetch;
  }

  /** Pide al motor el cambio `value` para la tira `stripId`. */
  send(stripId: string, value: T): void {
    const strip = this.inFlight.get(stripId);
    if (strip) {
      strip.pending = value;
      return;
    }
    this.put(stripId, value);
  }

  /** Si la tira tiene un envío en camino o pendiente. */
  busy(stripId: string): boolean {
    return this.inFlight.has(stripId);
  }

  /** Avisa a `listener` cada vez que una tira se queda sin envíos. Devuelve cómo dejar de oír. */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private put(stripId: string, value: T): void {
    const strip: InFlight<T> = { pending: undefined };
    this.inFlight.set(stripId, strip);
    const body = this.bodyOf(value);
    void this.fetch(`/api/strips/${encodeURIComponent(stripId)}/${this.resource}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(({ ok }) => ok)
      .catch(() => false)
      .then((applied) => {
        const { pending } = strip;
        this.inFlight.delete(stripId);
        // Si el motor ya tiene ese cambio, no hace falta pedirlo otra vez; si falló, sí.
        const repeated = pending !== undefined && canonical(this.bodyOf(pending)) === canonical(body);
        if (pending !== undefined && (!applied || !repeated)) {
          this.put(stripId, pending);
          return;
        }
        for (const listener of this.listeners) listener(stripId, applied);
      });
  }
}

/** La cola de los cambios de efecto: `PUT /api/strips/{stripId}/effect`. */
export function effectRequests(fetch?: FetchLike): StripRequests<EffectId> {
  return new StripRequests<EffectId>('effect', (effect): SetEffectBody => ({ effect }), fetch);
}

/** La cola de los cambios de valores: `PUT /api/strips/{stripId}/values`, con todos los valores. */
export function valueRequests(fetch?: FetchLike): StripRequests<SetValuesBody> {
  return new StripRequests<SetValuesBody>('values', (values) => values, fetch);
}
