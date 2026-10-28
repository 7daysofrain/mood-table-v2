import { Group } from '@mantine/core';
import type { EffectId } from '@moodtable/shared';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { AudioControl } from './audio/AudioControl.tsx';
import { AudioPlayer } from './audio/player.ts';
import { EngineConnection, viewerUrl } from './engine/connection.ts';
import { ControlList } from './controls/ControlList.tsx';
import type { ValueRequests } from './controls/use-draft-values.ts';
import { effectRequests, type StripRequests, valueRequests } from './engine/strip-requests.ts';
import { EffectList } from './effects/EffectList.tsx';
import { AudioSourceIndicator } from './layout/AudioSourceIndicator.tsx';
import { PanelLayout } from './layout/PanelLayout.tsx';
import { StripList } from './strips/StripList.tsx';
import { Viewer } from './viewer/Viewer.tsx';

/** Lo que el panel usa de la conexión con el motor: así los tests pueden darle una falsa. */
export type PanelConnection = Pick<
  EngineConnection,
  | 'status'
  | 'frames'
  | 'source'
  | 'sourceLost'
  | 'level'
  | 'strips'
  | 'subscribe'
  | 'subscribePositions'
  | 'start'
  | 'stop'
>;

/** Lo que el panel usa del envío de los cambios de efecto. */
export type PanelEffectRequests = Pick<StripRequests<EffectId>, 'send'>;

/** Lo que el panel usa del envío de los cambios de valores. */
export type PanelValueRequests = ValueRequests;

/** Lo que el panel usa del reproductor del fichero de audio. */
export type PanelPlayer = Pick<
  AudioPlayer,
  'state' | 'error' | 'jumps' | 'subscribe' | 'play' | 'stop' | 'open' | 'close'
>;

/**
 * Componente raíz del panel: se conecta al motor en la misma dirección que sirve el panel, la
 * cabecera muestra la fuente de audio, su nivel y el estado de la conexión, y el visor dibuja sus
 * frames. Con un fichero como fuente, la cabecera deja oírlo al ritmo del visor (change
 * panel-audio-playback). Las zonas Tiras y Efectos muestran las tiras del motor y cambian el
 * efecto de la seleccionada (change strip-effect-switch). La zona Controles mueve los valores de su
 * efecto activo (change strip-effect-values).
 */
export function App({
  connection: provided,
  player: providedPlayer,
  requests: providedRequests,
  valueRequests: providedValueRequests,
}: Readonly<{
  connection?: PanelConnection;
  player?: PanelPlayer;
  requests?: PanelEffectRequests;
  valueRequests?: PanelValueRequests;
}>) {
  const [connection] = useState<PanelConnection>(
    () => provided ?? new EngineConnection(viewerUrl(window.location)),
  );
  const [player] = useState<PanelPlayer>(() => providedPlayer ?? new AudioPlayer(connection));
  const [requests] = useState<PanelEffectRequests>(() => providedRequests ?? effectRequests());
  const [values] = useState<PanelValueRequests>(() => providedValueRequests ?? valueRequests());
  // La tira seleccionada se guarda por su `id`, también sin conexión: al volver, si sigue declarada,
  // vuelve a estar seleccionada, y si no, la primera (decisión 8).
  const [selectedId, setSelectedId] = useState<string>();

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
  const sourceLost = useSyncExternalStore(subscribe, () => connection.sourceLost);
  const strips = useSyncExternalStore(subscribe, () => connection.strips);
  const selected = strips?.find((strip) => strip.id === selectedId) ?? strips?.[0];
  // La que se selecciona sola (la primera al abrir, o al faltar la elegida) también se guarda: si no,
  // con las tiras en otro orden al volver, quedaría seleccionada otra. Sin tiras no se toca.
  if (selected && selected.id !== selectedId) setSelectedId(selected.id);

  return (
    <PanelLayout
      status={status}
      audio={
        <Group gap="xs" wrap="nowrap">
          <AudioSourceIndicator source={source} lost={sourceLost} levels={connection} />
          {source?.kind === 'file' && <AudioControl player={player} />}
        </Group>
      }
      viewer={<Viewer source={connection} />}
      strips={
        strips &&
        selected && (
          <StripList strips={strips} selectedId={selected.id} onSelect={setSelectedId} />
        )
      }
      effects={
        selected && (
          <EffectList
            active={selected.effect}
            hasAudioSource={source !== undefined && source.kind !== 'none'}
            onChoose={(effect) => {
              requests.send(selected.id, effect);
            }}
          />
        )
      }
      controls={selected && <ControlList strip={selected} requests={values} />}
    />
  );
}
