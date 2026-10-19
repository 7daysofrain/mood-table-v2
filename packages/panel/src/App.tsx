import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { EngineConnection, viewerUrl } from './engine/connection.ts';
import { AudioSourceIndicator } from './layout/AudioSourceIndicator.tsx';
import { PanelLayout } from './layout/PanelLayout.tsx';
import { Viewer } from './viewer/Viewer.tsx';

/** Lo que el panel usa de la conexión con el motor: así los tests pueden darle una falsa. */
export type PanelConnection = Pick<
  EngineConnection,
  'status' | 'frames' | 'source' | 'level' | 'subscribe' | 'start' | 'stop'
>;

/**
 * Componente raíz del panel: se conecta al motor en la misma dirección que sirve el panel, la
 * cabecera muestra la fuente de audio, su nivel y el estado de la conexión, y el visor dibuja sus
 * frames. El resto de zonas las
 * rellenan las historias de H2 y H4.
 */
export function App({ connection: provided }: Readonly<{ connection?: PanelConnection }>) {
  const [connection] = useState<PanelConnection>(
    () => provided ?? new EngineConnection(viewerUrl(window.location)),
  );

  useEffect(() => {
    connection.start();
    return () => {
      connection.stop();
    };
  }, [connection]);

  const subscribe = useCallback((listener: () => void) => connection.subscribe(listener), [connection]);
  const status = useSyncExternalStore(subscribe, () => connection.status);
  const source = useSyncExternalStore(subscribe, () => connection.source);

  return (
    <PanelLayout
      status={status}
      audio={<AudioSourceIndicator source={source} levels={connection} />}
      viewer={<Viewer source={connection} />}
    />
  );
}
