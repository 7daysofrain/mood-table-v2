/**
 * Indicador de conexión de la cabecera (specs/viewer). Sin implementar todavía: sus tests están en
 * rojo.
 */
import type { ConnectionStatus } from '../engine/connection.ts';

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  void status;
  return null;
}
