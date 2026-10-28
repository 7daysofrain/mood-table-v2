/**
 * La configuración del PR Babysitter (change pr-tracking, decisiones 3 y 8), de las variables de
 * entorno del contenedor, que vienen de un `.env` sin commitear (`.env.example` tiene los nombres).
 * Se valida con zod al arrancar: si falta algo o no vale, el proceso no arranca y dice qué
 * variable.
 */
import * as z from 'zod';

const required = z.string().trim().min(1, 'falta');
const positiveInteger = z.coerce
  .number('no es un número')
  .int('no es un número entero')
  .positive('tiene que ser mayor que 0');
const positiveNumber = z.coerce.number('no es un número').positive('tiene que ser mayor que 0');

const envSchema = z.object({
  GITHUB_TOKEN: required,
  GITHUB_MAINTAINER: required,
  LINEAR_CLIENT_ID: required,
  LINEAR_CLIENT_SECRET: required,
  LINEAR_MAINTAINER_PROFILE_URL: required.pipe(z.url('no es una URL')),
  LINEAR_INBOX_ISSUE_ID: required,
  DECISION_MODEL_API_KEY: required,
  GITHUB_REVIEWER: z.string().trim().min(1).default('chatgpt-codex-connector[bot]'),
  POLL_INTERVAL_SECONDS: positiveInteger.default(60),
  TRACKING_TIMEOUT_MINUTES: positiveInteger.default(30),
  DECISION_MODEL_BASE_URL: z.url('no es una URL').default('https://ollama.com'),
  DECISION_MODEL: z.string().trim().min(1).default('clef:27b'),
  // 0 vale: Clef en local no cobra.
  DECISION_MODEL_INPUT_PRICE_PER_MTOK: z.coerce
    .number('no es un número')
    .min(0, 'no puede ser negativo')
    .default(0.24),
  // Por encima de 0,5: si no, los cortes de real y no aplica se cruzarían.
  TRIAGE_THRESHOLD: z.coerce
    .number('no es un número')
    .gt(0.5, 'tiene que ser mayor que 0,5')
    .max(1, 'no puede pasar de 1')
    .default(0.8),
  TRIAGE_BUDGET_USD: positiveNumber.default(0.05),
});

export interface Config {
  /**
   * PAT fine-grained del mantenedor, limitado al repo (decisión 3): *Issues* y *Pull requests* en
   * escritura, para pedir la revisión, y sin *Contents*, así que no puede subir commits ni integrar
   * (change pr-review-request, decisión 1).
   */
  githubToken: string;
  /**
   * Login de GitHub del mantenedor, dueño de `githubToken`: solo se siguen sus PR, y solo cuentan las
   * peticiones de revisión de su cuenta (change pr-review-request, decisión 3).
   */
  githubMaintainer: string;
  /** Cuenta de GitHub del revisor: solo cuentan sus comentarios (decisión 7). */
  githubReviewer: string;
  linearClientId: string;
  linearClientSecret: string;
  /** URL del perfil del mantenedor en Linear, con la que se le menciona. */
  linearMaintainerProfileUrl: string;
  /** ID del issue buzón, para los avisos sin tarea (decisión 2). */
  linearInboxIssueId: string;
  /** Tiempo entre vueltas (decisión 8). */
  pollIntervalMs: number;
  /**
   * Cuánto se esperan las comprobaciones, desde que se ve un push, y la revisión, desde que pasan
   * (decisión 8; change pr-review-request, decisión 5).
   */
  trackingTimeoutMs: number;
  /**
   * El modelo de decisión del triaje (change pr-shadow-triage, decisión 3): la URL del proveedor,
   * sin `/v1/systemone`, el modelo fijado por su id y la clave de la cuenta.
   */
  decisionModelBaseUrl: string;
  decisionModel: string;
  decisionModelApiKey: string;
  /** Lo que cobra el proveedor por millón de tokens de entrada; la salida es gratis (decisión 6). */
  decisionModelInputPricePerMTok: number;
  /** La probabilidad a partir de la que un hallazgo es real; su complemento, no aplica (decisión 4). */
  triageThreshold: number;
  /** El tope de gasto del triaje de cada PR, en dólares (decisión 6). */
  triageBudgetUsd: number;
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
      githubReviewer: vars.GITHUB_REVIEWER,
      linearClientId: vars.LINEAR_CLIENT_ID,
      linearClientSecret: vars.LINEAR_CLIENT_SECRET,
      linearMaintainerProfileUrl: vars.LINEAR_MAINTAINER_PROFILE_URL,
      linearInboxIssueId: vars.LINEAR_INBOX_ISSUE_ID,
      pollIntervalMs: vars.POLL_INTERVAL_SECONDS * 1000,
      trackingTimeoutMs: vars.TRACKING_TIMEOUT_MINUTES * 60_000,
      decisionModelBaseUrl: vars.DECISION_MODEL_BASE_URL,
      decisionModel: vars.DECISION_MODEL,
      decisionModelApiKey: vars.DECISION_MODEL_API_KEY,
      decisionModelInputPricePerMTok: vars.DECISION_MODEL_INPUT_PRICE_PER_MTOK,
      triageThreshold: vars.TRIAGE_THRESHOLD,
      triageBudgetUsd: vars.TRIAGE_BUDGET_USD,
    },
  };
}
