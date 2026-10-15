/**
 * Fichero de configuración del instrumento (specs/engine-config): las tiras declaradas y los ajustes
 * de cada instalación. Sin implementar todavía: sus tests están en rojo.
 */

export interface StripConfig {
  id: string;
  name: string;
  output: { type: 'virtual' };
  ledCount: number;
}

export interface Config {
  fps: number;
  server: { host: string; port: number };
  strips: StripConfig[];
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; error: string };

export function parseConfig(text: string): ConfigResult {
  throw new Error(`Sin implementar (${text.length} caracteres)`);
}
