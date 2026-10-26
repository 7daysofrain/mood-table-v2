/**
 * La configuración del PR Babysitter (change pr-tracking, decisiones 3 y 8), de las variables de
 * entorno del contenedor, que vienen de un `.env` sin commitear (`.env.example` tiene los nombres).
 * Se valida con zod al arrancar: si falta algo o no vale, el proceso no arranca y dice qué
 * variable.
 */
import * as z from 'zod';

const required = z.string().trim().min(1, 'falta');

const envSchema = z.object({
  GITHUB_TOKEN: required,
  GITHUB_MAINTAINER: required,
  LINEAR_CLIENT_ID: required,
  LINEAR_CLIENT_SECRET: required,
  LINEAR_MAINTAINER_PROFILE_URL: required.pipe(z.url('no es una URL')),
  LINEAR_INBOX_ISSUE_ID: required,
  POLL_INTERVAL_SECONDS: z.coerce
    .number('no es un número')
    .int('no es un número entero')
    .positive('tiene que ser mayor que 0')
    .default(60),
});

export interface Config {
  /** PAT fine-grained de solo lectura, limitado al repo (decisión 3). */
  githubToken: string;
  /** Login de GitHub del mantenedor: solo se siguen sus PR. */
  githubMaintainer: string;
  linearClientId: string;
  linearClientSecret: string;
  /** URL del perfil del mantenedor en Linear, con la que se le menciona. */
  linearMaintainerProfileUrl: string;
  /** ID del issue buzón, para los avisos sin tarea (decisión 2). */
  linearInboxIssueId: string;
  /** Tiempo entre vueltas (decisión 8). */
  pollIntervalMs: number;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; error: string };

/** Lee la configuración de las variables de entorno. Una variable vacía cuenta como que falta. */
export function loadConfig(env: Record<string, string | undefined>): ConfigResult {
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const name = issue.path.join('.');
      return `- ${name}: ${name in present ? issue.message : 'falta'}`;
    });
    return {
      ok: false,
      error: ['La configuración del PR Babysitter no vale (mira .env.example):', ...lines].join('\n'),
    };
  }
  const vars = parsed.data;
  return {
    ok: true,
    config: {
      githubToken: vars.GITHUB_TOKEN,
      githubMaintainer: vars.GITHUB_MAINTAINER,
      linearClientId: vars.LINEAR_CLIENT_ID,
      linearClientSecret: vars.LINEAR_CLIENT_SECRET,
      linearMaintainerProfileUrl: vars.LINEAR_MAINTAINER_PROFILE_URL,
      linearInboxIssueId: vars.LINEAR_INBOX_ISSUE_ID,
      pollIntervalMs: vars.POLL_INTERVAL_SECONDS * 1000,
    },
  };
}
