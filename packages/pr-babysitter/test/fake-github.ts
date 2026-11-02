/**
 * Lo que comparten los tests de los adaptadores que leen GitHub: las respuestas grabadas de
 * `test/fixtures/github/` y un `fetch` falso que las sirve.
 */
import { readFile } from 'node:fs/promises';

export async function fixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/github/${name}`, import.meta.url), 'utf8');
}

export interface Call {
  method: string;
  url: string;
  authorization: string | null;
  /** El cuerpo de la petición, vacío en las lecturas. */
  body: string;
}

/**
 * Un `fetch` falso que guarda cada petición y responde lo que diga `respond`, que la recibe para
 * poder responder según la URL o el cuerpo. Como el real, la respuesta lleva la URL pedida:
 * `octokit.paginate` la lee en las listas con `total_count` (*check runs*).
 */
export function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const call = {
      method: request.method,
      url: request.url,
      authorization: request.headers.get('authorization'),
      body: await request.text(),
    };
    calls.push(call);
    const response = await respond(call);
    Object.defineProperty(response, 'url', { value: request.url });
    return response;
  };
  return { fetch, calls };
}

export function json(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

export function text(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}
