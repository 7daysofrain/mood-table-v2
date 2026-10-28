/**
 * Envío de los cambios de efecto al motor (decisión 7 del change strip-effect-switch): cada elección
 * del DJ sale al momento por `PUT /api/strips/{stripId}/effect`. Como mucho hay uno en camino por
 * tira, con la última elección pendiente: dos `PUT` de la misma tira en paralelo podrían llegar al
 * motor en otro orden, y debe ganar lo último que pulsó el DJ. No avisa de nada: el panel marca el
 * efecto activo cuando el motor lo dice por el WebSocket, y un error se ve en el visor (PRD Q8).
 */
import type { EffectId, SetEffectBody } from '@moodtable/shared';

/** Lo que el envío usa de `fetch`: así los tests pueden darle uno falso. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok'>>;

/** Una tira con una petición en camino. */
interface InFlight {
  /** La última elección hecha mientras tanto. */
  pending: EffectId | undefined;
}

export class EffectRequests {
  private readonly fetch: FetchLike;
  /** Las tiras con una petición en camino. */
  private readonly inFlight = new Map<string, InFlight>();

  constructor(fetch: FetchLike = (url, init) => globalThis.fetch(url, init)) {
    this.fetch = fetch;
  }

  /** Pide al motor que la tira `stripId` pase a pintar `effect`. */
  send(stripId: string, effect: EffectId): void {
    const strip = this.inFlight.get(stripId);
    if (strip) {
      strip.pending = effect;
      return;
    }
    this.put(stripId, effect);
  }

  private put(stripId: string, effect: EffectId): void {
    const strip: InFlight = { pending: undefined };
    this.inFlight.set(stripId, strip);
    const body: SetEffectBody = { effect };
    void this.fetch(`/api/strips/${encodeURIComponent(stripId)}/effect`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(({ ok }) => ok)
      .catch(() => false)
      .then((applied) => {
        const { pending } = strip;
        this.inFlight.delete(stripId);
        // Si el motor ya tiene ese efecto, no hace falta pedirlo otra vez; si falló, sí.
        if (pending && (!applied || pending !== effect)) this.put(stripId, pending);
      });
  }
}
