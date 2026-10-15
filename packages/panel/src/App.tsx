import type { EngineConnection } from './engine/connection.ts';
import { PanelLayout } from './layout/PanelLayout.tsx';

/** Lo que el panel usa de la conexión con el motor: así los tests pueden darle una falsa. */
export type PanelConnection = Pick<EngineConnection, 'status' | 'frames' | 'subscribe' | 'start' | 'stop'>;

/**
 * Componente raíz del panel. Sin implementar todavía la conexión: sus tests están en rojo.
 */
export function App({ connection }: { connection?: PanelConnection }) {
  void connection;
  return <PanelLayout status="disconnected" />;
}
