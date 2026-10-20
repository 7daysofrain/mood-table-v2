/**
 * Control de oír el fichero de audio (decisión 7 del change panel-audio-playback): un botón en la
 * cabecera, junto a la fuente, con tres estados. Callado (altavoz tachado), pide oír; mientras
 * prepara el audio, avisa y no hace nada; sonando (altavoz con ondas), lo calla. Quién lo muestra decide cuándo hay algo que oír: solo con un
 * fichero como fuente.
 */
import { ActionIcon } from '@mantine/core';
import { type ReactElement, useCallback, useSyncExternalStore } from 'react';

import type { AudioPlayer } from './player.ts';

/** Lo que el control usa del reproductor: así los tests pueden darle uno falso. */
export type ControlPlayer = Pick<AudioPlayer, 'state' | 'subscribe' | 'play' | 'stop'>;

/**
 * Iconos de escucha, no de transporte: el fichero sigue sonando en el motor aunque el panel calle.
 * Como en los reproductores de vídeo, el icono muestra el estado (¿suena el panel?) y el nombre
 * accesible, la acción. Dos SVG de un trazo, sin una librería de iconos para solo dos.
 */
function SpeakerIcon({ muted }: Readonly<{ muted: boolean }>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

export function AudioControl({ player }: Readonly<{ player: ControlPlayer }>): ReactElement {
  const subscribe = useCallback((listener: () => void) => player.subscribe(listener), [player]);
  const state = useSyncExternalStore(subscribe, () => player.state);

  if (state === 'preparing') {
    return (
      <ActionIcon variant="light" size="lg" aria-label="Preparando el audio" loading disabled />
    );
  }
  if (state === 'playing') {
    return (
      <ActionIcon
        variant="filled"
        size="lg"
        aria-label="Dejar de oír el fichero de audio"
        onClick={() => {
          player.stop();
        }}
      >
        <SpeakerIcon muted={false} />
      </ActionIcon>
    );
  }
  return (
    <ActionIcon
      variant="light"
      size="lg"
      aria-label="Oír el fichero de audio"
      onClick={() => {
        player.play();
      }}
    >
      <SpeakerIcon muted />
    </ActionIcon>
  );
}
