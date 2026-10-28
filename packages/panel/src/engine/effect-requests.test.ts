import type { EffectId } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { EffectRequests, type FetchLike } from './effect-requests.ts';

interface Sent {
  url: string;
  method: string | undefined;
  contentType: string | null;
  body: unknown;
  /** Termina la petición: con `ok`, como una respuesta del motor; sin él, como un error de red. */
  finish(outcome: { ok: boolean } | 'network-error'): Promise<void>;
}

/** Un `fetch` falso: guarda cada petición y el test decide cuándo y cómo termina. */
function fakeFetch() {
  const sent: Sent[] = [];
  const fetch: FetchLike = (url, init) =>
    new Promise((resolve, reject) => {
      sent.push({
        url,
        method: init.method,
        contentType: new Headers(init.headers).get('content-type'),
        body: JSON.parse(init.body as string),
        finish: async (outcome) => {
          if (outcome === 'network-error') reject(new TypeError('Failed to fetch'));
          else resolve(outcome);
          // Deja que el envío reaccione antes de que el test mire.
          await new Promise((settled) => setTimeout(settled));
        },
      });
    });
  return { fetch, sent };
}

function effectsOf(sent: readonly Sent[]): EffectId[] {
  return sent.map(({ body }) => (body as { effect: EffectId }).effect);
}

function at(sent: readonly Sent[], index: number): Sent {
  const request = sent[index];
  if (!request) throw new Error(`No se ha enviado la petición ${index}`);
  return request;
}

describe('el envío de los cambios de efecto', () => {
  it('un cambio envía PUT /api/strips/{stripId}/effect con el efecto en JSON, al momento', () => {
    const { fetch, sent } = fakeFetch();

    new EffectRequests(fetch).send('barra', 'breathing');

    expect(sent).toHaveLength(1);
    expect(at(sent, 0)).toMatchObject({
      url: '/api/strips/barra/effect',
      method: 'PUT',
      contentType: 'application/json',
      body: { effect: 'breathing' },
    });
  });

  it('el id de la tira va escapado en la ruta', () => {
    const { fetch, sent } = fakeFetch();

    new EffectRequests(fetch).send('barra/cabina', 'breathing');

    expect(at(sent, 0).url).toBe('/api/strips/barra%2Fcabina/effect');
  });

  it('con uno en camino, los siguientes esperan y al terminar solo se envía el último', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);

    requests.send('barra', 'breathing');
    requests.send('barra', 'energy');
    requests.send('barra', 'breathing');
    requests.send('barra', 'energy');
    expect(effectsOf(sent)).toEqual(['breathing']);

    await at(sent, 0).finish({ ok: true });

    expect(effectsOf(sent)).toEqual(['breathing', 'energy']);
  });

  it('no envía el pendiente si coincide con el último enviado', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);

    requests.send('barra', 'energy');
    requests.send('barra', 'breathing');
    requests.send('barra', 'energy');
    await at(sent, 0).finish({ ok: true });

    expect(effectsOf(sent)).toEqual(['energy']);
  });

  it('sin ninguno en camino, envía aunque coincida con el anterior', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);
    requests.send('barra', 'energy');
    await at(sent, 0).finish({ ok: true });

    requests.send('barra', 'energy');

    expect(effectsOf(sent)).toEqual(['energy', 'energy']);
  });

  it('cada tira tiene su propio envío: un cambio de otra tira no espera ni se pierde', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);

    requests.send('barra', 'breathing');
    requests.send('cabina', 'energy');
    requests.send('barra', 'energy');
    requests.send('cabina', 'breathing');
    expect(sent.map(({ url }) => url)).toEqual([
      '/api/strips/barra/effect',
      '/api/strips/cabina/effect',
    ]);

    await at(sent, 0).finish({ ok: true });
    await at(sent, 1).finish({ ok: true });

    expect(sent.slice(2).map(({ url, body }) => [url, body])).toEqual([
      ['/api/strips/barra/effect', { effect: 'energy' }],
      ['/api/strips/cabina/effect', { effect: 'breathing' }],
    ]);
  });

  it('una respuesta de error no bloquea el siguiente', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);
    requests.send('barra', 'energy');
    requests.send('barra', 'breathing');

    await at(sent, 0).finish({ ok: false });

    expect(effectsOf(sent)).toEqual(['energy', 'breathing']);
    await at(sent, 1).finish({ ok: true });
    requests.send('barra', 'energy');
    expect(effectsOf(sent)).toEqual(['energy', 'breathing', 'energy']);
  });

  it('un error de red no bloquea el siguiente y no se escapa como error sin capturar', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);
    requests.send('barra', 'energy');

    await at(sent, 0).finish('network-error');
    requests.send('barra', 'breathing');

    expect(effectsOf(sent)).toEqual(['energy', 'breathing']);
  });

  it('si el que estaba en camino falla, el pendiente se envía aunque sea el mismo efecto', async () => {
    const { fetch, sent } = fakeFetch();
    const requests = new EffectRequests(fetch);
    requests.send('barra', 'energy');
    requests.send('barra', 'energy');

    await at(sent, 0).finish('network-error');

    expect(effectsOf(sent)).toEqual(['energy', 'energy']);
  });

  it('sin un fetch propio, usa el del navegador', () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (input) => {
      urls.push(input as string);
      return new Promise(() => undefined);
    };
    try {
      new EffectRequests().send('barra', 'breathing');
    } finally {
      globalThis.fetch = original;
    }

    expect(urls).toEqual(['/api/strips/barra/effect']);
  });
});
