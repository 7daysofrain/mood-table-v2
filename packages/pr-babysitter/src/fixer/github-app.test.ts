import { createVerify, generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { appJwt, installationToken } from './github-app.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

const app = { clientId: 'Iv23liPrBabysitter', privateKey: privateKeyPem };
const now = new Date('2026-11-27T10:00:00Z');

function decode(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('el JWT de la App (design.md decisión 2)', () => {
  it('va firmado con RS256 por la clave privada, con la App como emisor', () => {
    const [header, payload, signature] = appJwt(app, now).split('.') as [string, string, string];

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const verify = createVerify('RSA-SHA256');
    verify.update(`${header}.${payload}`);
    expect(verify.verify(publicKey, signature, 'base64url')).toBe(true);
    expect(decode(payload)).toMatchObject({ iss: 'Iv23liPrBabysitter' });
  });

  it('vale de un minuto antes a nueve después, dentro de los diez que admite GitHub', () => {
    const payload = decode(appJwt(app, now).split('.')[1] as string) as { iat: number; exp: number };
    const seconds = now.getTime() / 1000;

    expect(payload.iat).toBe(seconds - 60);
    expect(payload.exp).toBe(seconds + 9 * 60);
  });
});

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      headers: init?.headers as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const response = responses[`${method} ${url}`];
    if (!response) return Promise.reject(new Error(`petición inesperada: ${method} ${url}`));
    return Promise.resolve(new Response(JSON.stringify(response.body), { status: response.status }));
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('el token de instalación', () => {
  it('busca la instalación del repo y pide un token limitado a ese repo, con el JWT', async () => {
    const { fetch, calls } = fakeFetch({
      'GET https://api.github.com/repos/7daysofrain/mood-table-v2/installation': {
        status: 200,
        body: { id: 4242 },
      },
      'POST https://api.github.com/app/installations/4242/access_tokens': {
        status: 201,
        body: { token: 'ghs_token', expires_at: '2026-11-27T11:00:00Z' },
      },
    });

    const token = await installationToken(fetch, app, '7daysofrain/mood-table-v2', now);

    expect(token).toEqual({ token: 'ghs_token', expiresAt: '2026-11-27T11:00:00Z' });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
      expect(call.headers.accept).toBe('application/vnd.github+json');
    }
    expect(calls[1]?.body).toEqual({ repositories: ['mood-table-v2'] });
  });

  it('si la App no está instalada en el repo, lo dice', async () => {
    const { fetch } = fakeFetch({
      'GET https://api.github.com/repos/7daysofrain/mood-table-v2/installation': {
        status: 404,
        body: { message: 'Not Found' },
      },
    });

    await expect(installationToken(fetch, app, '7daysofrain/mood-table-v2', now)).rejects.toThrow(
      /no está instalada en 7daysofrain\/mood-table-v2/,
    );
  });

  it('si GitHub rechaza el token, lanza con su estado y sin el JWT', async () => {
    const { fetch } = fakeFetch({
      'GET https://api.github.com/repos/7daysofrain/mood-table-v2/installation': {
        status: 200,
        body: { id: 4242 },
      },
      'POST https://api.github.com/app/installations/4242/access_tokens': {
        status: 401,
        body: { message: 'A JSON web token could not be decoded' },
      },
    });

    const attempt = installationToken(fetch, app, '7daysofrain/mood-table-v2', now);

    await expect(attempt).rejects.toThrow(/401/);
    await expect(attempt).rejects.not.toThrow(/Bearer/);
  });
});
