import { Group } from '@mantine/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { AudioControl } from './audio/AudioControl.tsx';
import { AudioPlayer } from './audio/player.ts';
import { EngineConnection, viewerUrl } from './engine/connection.ts';
import { AudioSourceIndicator } from './layout/AudioSourceIndicator.tsx';
import { PanelLayout } from './layout/PanelLayout.tsx';
import { Viewer } from './viewer/Viewer.tsx';

/** Lo que el panel usa de la conexión con el motor: así los tests pueden darle una falsa. */
export type PanelConnection = Pick<
  EngineConnection,
  'status' | 'frames' | 'source' | 'level' | 'subscribe' | 'subscribePositions' | 'start' | 'stop'
>;

/** Lo que el panel usa del reproductor del fichero de audio. */
export type PanelPlayer = Pick<
  AudioPlayer,
  'state' | 'error' | 'jumps' | 'subscribe' | 'play' | 'stop' | 'open' | 'close'
>;

/**
 * Componente raíz del panel: se conecta al motor en la misma dirección que sirve el panel, la
 * cabecera muestra la fuente de audio, su nivel y el estado de la conexión, y el visor dibuja sus
 * frames. Con un fichero como fuente, la cabecera deja oírlo al ritmo del visor (change
 * panel-audio-playback). El resto de zonas las rellenan las historias de H2 y H4.
 */
export function App({
  connection: provided,
  player: providedPlayer,
}: Readonly<{ connection?: PanelConnection; player?: PanelPlayer }>) {
  const [connection] = useState<PanelConnection>(
    () => provided ?? new EngineConnection(viewerUrl(window.location)),
  );
  const [player] = useState<PanelPlayer>(() => providedPlayer ?? new AudioPlayer(connection));

  useEffect(() => {
    connection.start();
    return () => {
      connection.stop();
    };
  }, [connection]);

  // El reproductor escucha la conexión mientras el panel está abierto; al cerrarse, calla y suelta
  // el contexto de audio. Los E2E no pueden oír: leen su estado, el error de sincronía y los saltos,
  // sin poder tocar nada (decisión 8 del change panel-audio-playback).
  useEffect(() => {
    player.open();
    Object.defineProperty(window, 'moodTableAudio', {
      configurable: true,
      get: () => ({ state: player.state, error: player.error, jumps: player.jumps }),
    });
    return () => {
      player.close();
      Reflect.deleteProperty(window, 'moodTableAudio');
    };
  }, [player]);

  const subscribe = useCallback((listener: () => void) => connection.subscribe(listener), [connection]);
  const status = useSyncExternalStore(subscribe, () => connection.status);
  const source = useSyncExternalStore(subscribe, () => connection.source);

  return (
    <PanelLayout
      status={status}
      audio={
        <Group gap="xs" wrap="nowrap">
          <AudioSourceIndicator source={source} levels={connection} />
          {source?.kind === 'file' && <AudioControl player={player} />}
        </Group>
      }
      viewer={<Viewer source={connection} />}
    />
  );
}
